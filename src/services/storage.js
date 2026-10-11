// @ts-check
import { LEGACY_KEYS, STORAGE_KEYS, STORAGE_PREFIX } from "../config.js";
import { migrateLegacy } from "../core/migration.js";
import { APP_CACHE_PREFIX, isAppStorageKey } from "../core/privacy.js";

/**
 * @typedef {{ getItem(k: string): string|null, setItem(k: string, v: string): void, removeItem(k: string): void, key?: (i: number) => string|null, length?: number }} StorageBackend
 */

/**
 * Accès sûr à localStorage : peut lever une SecurityError (cookies bloqués, navigation privée stricte).
 * @param {() => StorageBackend} getter
 * @returns {StorageBackend|null}
 */
export function safeBackend(getter) {
    try {
        const backend = getter();
        const probe = `${STORAGE_PREFIX}probe`;
        backend.setItem(probe, "1");
        backend.removeItem(probe);
        return backend;
    } catch {
        return null;
    }
}

/**
 * @param {StorageBackend|null} backend
 * @param {{ onError?: (kind: "unavailable"|"quota"|"write", key: string) => void }} [options]
 */
export function createStorage(backend, options = {}) {
    const onError = options.onError || (() => {});
    return {
        available: backend !== null,
        /**
         * @template T
         * @param {string} key
         * @param {(raw: unknown) => T} sanitize
         * @returns {T}
         */
        read(key, sanitize) {
            if (!backend) return sanitize(undefined);
            let raw;
            try {
                const text = backend.getItem(STORAGE_PREFIX + key);
                raw = text === null ? undefined : JSON.parse(text);
            } catch {
                raw = undefined;
            }
            return sanitize(raw);
        },
        /**
         * @param {string} key
         * @param {unknown} value
         * @returns {boolean}
         */
        write(key, value) {
            if (!backend) {
                onError("unavailable", key);
                return false;
            }
            try {
                backend.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
                return true;
            } catch (error) {
                onError(error instanceof Error && /quota/i.test(error.name + error.message) ? "quota" : "write", key);
                return false;
            }
        },
        /** @param {string} key */
        remove(key) {
            try {
                backend?.removeItem(STORAGE_PREFIX + key);
            } catch {
                /* rien à faire : la donnée reste simplement présente */
            }
        }
    };
}

/**
 * Supprime les clés v1 (fce_*). Appelée après une migration réussie : garder une copie
 * contredirait le droit à l'effacement (un favori supprimé en v2 subsistait en v1, anomalie #27).
 * @param {StorageBackend} backend
 */
function removeLegacyKeys(backend) {
    for (const key of Object.values(LEGACY_KEYS)) backend.removeItem(key);
}

/**
 * Migre une seule fois les clés v1 (fce_*) vers le format v2, puis les supprime si toutes les écritures ont réussi.
 * @param {StorageBackend|null} backend
 * @param {ReturnType<typeof createStorage>} storage
 * @param {string} nowIso
 * @returns {boolean} true si une migration a eu lieu
 */
export function migrateFromV1(backend, storage, nowIso) {
    if (!backend) return false;
    const marker = `${STORAGE_PREFIX}migrated`;
    try {
        if (backend.getItem(marker)) {
            // Installations migrées par la 2.0.0, qui conservait les clés v1.
            removeLegacyKeys(backend);
            return false;
        }
        /** @param {string} key */
        const parse = key => {
            const text = backend.getItem(key);
            if (text === null) return undefined;
            try {
                return JSON.parse(text);
            } catch {
                return text;
            }
        };
        const legacy = {
            favorites: parse(LEGACY_KEYS.favorites),
            favoriteMeta: parse(LEGACY_KEYS.favoriteMeta),
            history: parse(LEGACY_KEYS.history),
            saved: parse(LEGACY_KEYS.saved),
            compare: parse(LEGACY_KEYS.compare),
            theme: parse(LEGACY_KEYS.theme)
        };
        const hasLegacy = Object.values(legacy).some(v => v !== undefined);
        if (hasLegacy) {
            const m = migrateLegacy(legacy, nowIso);
            const written = [
                storage.write(STORAGE_KEYS.favorites, m.favorites),
                storage.write(STORAGE_KEYS.favoriteMeta, m.favoriteMeta),
                storage.write(STORAGE_KEYS.compare, m.compare),
                storage.write(STORAGE_KEYS.history, m.history),
                storage.write(STORAGE_KEYS.saved, m.saved),
                m.theme === "system" || storage.write(STORAGE_KEYS.prefs, { theme: m.theme })
            ];
            // Échec partiel : on garde les clés v1 pour retenter au prochain chargement.
            if (written.includes(false)) return false;
            removeLegacyKeys(backend);
        }
        backend.setItem(marker, nowIso);
        return hasLegacy;
    } catch {
        return false;
    }
}

/**
 * Liste les clés de l'application présentes dans un stockage (clé → valeur brute).
 * @param {StorageBackend|null} backend
 * @returns {Record<string, string>}
 */
export function readAppKeys(backend) {
    /** @type {Record<string, string>} */
    const out = {};
    if (!backend || typeof backend.key !== "function") return out;
    try {
        for (let i = 0; i < (backend.length || 0); i += 1) {
            const key = backend.key(i);
            if (key && isAppStorageKey(key)) out[key] = backend.getItem(key) ?? "";
        }
    } catch {
        /* stockage devenu inaccessible : inventaire vide */
    }
    return out;
}

/**
 * Efface toutes les données de l'application (droit à l'effacement, art. 17 RGPD) :
 * clés v2 et v1 du localStorage, état du Labo QA en sessionStorage, caches du service worker.
 * Ne touche jamais aux clés d'autres applications de la même origine.
 * @param {{ local: StorageBackend|null, session: StorageBackend|null, caches?: { keys(): Promise<string[]>, delete(name: string): Promise<boolean> } | null }} targets
 * @returns {Promise<{ keys: number, caches: number }>}
 */
export async function eraseAppData(targets) {
    let keys = 0;
    for (const backend of [targets.local, targets.session]) {
        for (const key of Object.keys(readAppKeys(backend))) {
            try {
                backend?.removeItem(key);
                keys += 1;
            } catch {
                /* clé non supprimable : comptée comme restante par l'inventaire */
            }
        }
    }
    let caches = 0;
    if (targets.caches) {
        try {
            for (const name of await targets.caches.keys()) {
                if (name.startsWith(APP_CACHE_PREFIX) && (await targets.caches.delete(name))) caches += 1;
            }
        } catch {
            /* Cache Storage indisponible (contexte non sécurisé) */
        }
    }
    return { keys, caches };
}
