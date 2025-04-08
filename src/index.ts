/** IndexDB-Cache
 * 
 * @author Alex Malotky
 */

/** Cache Store Interface
 * 
 */
export interface CacheStore<K extends IDBValidKey, V> {
    set:(key:K, vvalue:V, ttl?:number|Date)=>Promise<void>
    remove:(key:K)=>Promise<void>
    get:(key:K)=>Promise<V|null>
    clear:()=>Promise<void>
    close:()=>void
}

/** Cache Options
 * 
 */
export interface CacheOptions {
    corupted?: CoruptedHandler
    defaultTtl?:number|Date
}

/** Cache Store Options
 * 
 */
export interface CacheStoreOptions<T>{
    validate?:(v:unknown)=>v is T
    defaultTtl?:number|Date
}

/** Cache Store Generator
 * 
 */
export type CacheStoreGenerator = (name:string, opts:CacheStoreOptions<unknown>)=>Promise<CacheStore<any, unknown>>;

/** UpgradeCacheFunction
 * 
 */
export type CoruptedHandler = (db:IDBDatabase, v:number)=>Promise<IDBDatabase>|IDBDatabase

/** Cache Store Item
 * 
 */
interface CacheStoreItem<T> {
    value: T,
    ttl: number
}

/** Open Database Wrapper Function
 * 
 * 
 */
function openDB(name:string, version?:number, upgrade?:(db:IDBDatabase)=>Promise<void>|void):Promise<IDBDatabase> {
    return new Promise((res, rej)=>{
        const req = indexedDB.open(name, version);
        req.onblocked = () => rej(new Error("IDBDatabase 'Open Database' Blocked!"));
        req.onerror   = () => rej(req.error);
        req.onsuccess = () => res(req.result);

        if(upgrade)
            req.onupgradeneeded = async(event) => await upgrade(req.result);
    });
}

/** Delete Database Wrapper Function
 * 
 * @returns {Promise<void>}
 */
function deleteDB(name:string):Promise<void> {
    return new Promise((res, rej)=>{
        const req = indexedDB.deleteDatabase(name);
        req.onblocked = () => rej(new Error("IDBDatabase 'Delete Database' Blocked!"));
        req.onerror   = () => rej(req.error);
        req.onsuccess = () => res();
    });
}

/** Index Database Request Wrapper
 * 
 * @param {IDBRequest} req
 * @returns {Promise}
 */
function wrapRequest<T>(req:IDBRequest<T>):Promise<T> {
    return new Promise((res, rej)=>{
        req.onerror   = () => rej(req.error);
        req.onsuccess = () => res(req.result);
    });
}

/** Initalize IndexDB Connection
 * 
 * @param {string} cacheName 
 * @param {string} storeName 
 * @param {CoruptedHandler} corupted 
 * @returns {Promise<IDBDatabase>}
 */
async function initDB(cacheName:string, storeName:string, corupted?:CoruptedHandler):Promise<IDBDatabase> {
    const db = await openDB(cacheName, undefined, (db)=>{
        db.createObjectStore(storeName);
    });

    if(db.objectStoreNames.contains(storeName))
        return db;

    db.createObjectStore(storeName);

    let version = db.objectStoreNames.length+1;
    if(version < db.version) {
        if(corupted){
            return await corupted(db, version);
        } else {
            db.close();
            await deleteDB(cacheName);
            version = 1;
        }
    } else {
        db.close();
    }

    return await openDB(cacheName, version, (db)=>{
        db.createObjectStore(storeName);
    });
}

/** Format Ttl
 * 
 * @param {Array<number|Date>} values 
 * @returns {number|undefined}
 */
function formatTtl(...values:Array<number|Date|undefined>):number|undefined {
    for(const v of values) {
        if(v instanceof Date)
            return v.getTime()
        else if(typeof v === "number")
            return Date.now() + v;
    }

    return undefined;
}

/** Initalize Cache
 * 
 * @param {string} cacheName 
 * @param {CacheOptions} cacheOpts 
 * @returns {CacheStoreGenerator}
 */
export function initalizeCache(cacheName:string, cacheOpts:CacheOptions = {}):CacheStoreGenerator {

    /** Generate Cache Store
     * 
     * @param {string} name
     * @param {CacheStoreOptions} opts
     * @returns {Promise<Cache>}
     */
    return async function generateCacheStore<K extends IDBValidKey, V>(name:string, opts:CacheStoreOptions<V> = {}):Promise<CacheStore<K, V>>{
        let db:IDBDatabase|null = await initDB(cacheName, name, cacheOpts.corupted);
        const defaultTtl = opts.defaultTtl || cacheOpts.defaultTtl;

        return {
            /** Set Value
             * 
             * @param {K} key 
             * @param {V} value 
             * @param {number|Date} ttl 
             * @returns {Promise<void>}
             */
            set(key:K, value:V, ttl?:number|Date):Promise<void> {
                return new Promise((res, rej)=>{
                    ttl = formatTtl(ttl, defaultTtl);

                    if(ttl === undefined)
                        return rej(new Error("No Ttl was set!"));
    
                    if(db === null)
                        return rej(new Error("IndexDB Connection is Closed!"));

                    const tx = db.transaction(name, "readwrite");
                    tx.onerror = () => rej(tx.error);
                    tx.onabort = () => rej(new Error("Set Transaction Aborted!"));

                    wrapRequest(tx.objectStore(name).put({ttl, value} satisfies CacheStoreItem<V>, key))
                        .then(()=>res()).catch(rej);
                });
            },

            /** Get Value
             * 
             * @param {K} key 
             * @returns {Promise<V|null>}
             */
            get(key:K):Promise<V|null> {
                return new Promise((res, rej)=>{
                    if(db === null)
                        return rej(new Error("Database Connection was closed!"));

                    const tx = db.transaction(name, "readwrite");
                    tx.onerror = () => rej(tx.error);
                    tx.onabort = () => rej(new Error("Get Transaction Aborted!"));

                    const store = tx.objectStore(name);
                    wrapRequest<CacheStoreItem<V>|undefined>(store.get(key)).then(result => {
                        if(result){
                            if(typeof result.ttl !== "number") {
                                console.warn("Invalid CacheStoreItem: TTL is not a number!");
                                wrapRequest(store.delete(key))
                                    .then(()=>res(null)).catch(rej);

                            } else if(result.ttl >= 0 && result.ttl < Date.now()) {
                                res(null);

                            } else {
                                if(opts.validate && !opts.validate(result.value)) {
                                    console.warn("Invalid CacheStoreItem: Value failed validation!");
                                    wrapRequest(store.delete(key))
                                        .then(()=>res(null)).catch(rej);

                                } else if(result.value === undefined || result.value === null){
                                    console.warn("Invalid CacheStoreItem: Value is undefined!");
                                    wrapRequest(store.delete(key))
                                        .then(()=>res(null)).catch(rej);

                                } else {
                                    res(result.value);
                                }
                            }

                        } else {
                            res(null);
                        }
                    }).catch(rej);
                });
            },

            /** Remove Value
             * 
             * @param {K} key 
             * @returns {Promise<void>}
             */
            remove(key:K):Promise<void> {
                return new Promise((res, rej)=>{
                    if(db === null)
                        return rej(new Error("Database Connection was closed!"));

                    const tx = db.transaction(name, "readwrite");
                    tx.onerror = () => rej(tx.error);
                    tx.onabort = () => rej(new Error("Remove Transaction Aborted!"));

                    wrapRequest(tx.objectStore(name).delete(key))
                        .then(res).catch(rej);
                });
            },

            /** Clear Cache Store
             * 
             * @returns {Promise<void>}
             */
            clear():Promise<void> {
                return new Promise((res, rej)=>{
                    if(db === null)
                        return rej(new Error("Database Connection was closed!"));

                    const tx = db.transaction(name, "readwrite");
                    tx.onerror = () => rej(tx.error);
                    tx.onabort = () => rej(new Error("Clear Transaction Aborted!"));

                    wrapRequest(tx.objectStore(name).clear())
                        .then(res).catch(rej);
                })
            },

            /** Close Connection
             * 
             */
            close():void {
                if(db){
                    db.close();
                    db = null;
                }
            }
        }
    }
}

export default initalizeCache("Cache", {defaultTtl: -1});