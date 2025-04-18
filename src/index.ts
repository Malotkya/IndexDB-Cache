/** IndexDB-Cache
 * 
 * @author Alex Malotky
 */

/** Cache Store Interface
 * 
 */
export interface CacheStore<K extends IDBValidKey, V> {
    /** Set Value
     * 
     * @param {K} key 
     * @param {V} value 
     * @param {number|Date} ttl 
     * @returns {Promise<void>}
     */
    set:(key:K, value:V, ttl?:number|Date)=>Promise<void>

    /** Get Value
     * 
     * @param {K} key 
     * @returns {Promise<V|null>}
     */
    remove:(key:K)=>Promise<void>

    /** Remove Value
     * 
     * @param {K} key 
     * @returns {Promise<void>}
     */
    get:(key:K)=>Promise<V|null>

    /** Clear Cache Store
     * 
     * @returns {Promise<void>}
        */
    clear:()=>Promise<void>

    /** Get Count
     * 
     * Gets the number of entries stored in the cache.
     * 
     * @returns {Promise<number>}
     */
    count:()=>Promise<number>

    /** Entries Iterator
     * 
     * @returns {Promise<CacheIteratorK, V>}
     */
    entries:()=>Promise<CacheIterator<K, V>>

    /** Close Connection
     * 
     */
    close:()=>void
}

interface CacheIterator<K extends IDBValidKey, V> {
    [Symbol.asyncIterator]:()=>this
    next:()=>Promise<{value:CacheIteratorValue<K, V>, done:boolean}>
}

type CacheIteratorValue<K extends IDBValidKey, V> = [key:K, value:V];

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
        if(v instanceof Date) {
            return v.getTime()
        } else if(typeof v === "number") {
            if(v < 0)
                return v;
            return Date.now() + v;
        }
    }

    return undefined;
}

/** Initalize Cache
 * 
 * @param {string} cacheName 
 * @param {CacheOptions} cacheOpts 
 * @returns {CacheStoreGenerator}
 */
export function initalizeCache(cacheName:string, cacheOpts:CacheOptions = {}) {

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
                        return rej(new Error("No Ttl is set!"));
    
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
                        return rej(new Error("Database Connection is closed!"));

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
                        return rej(new Error("Database Connection is closed!"));

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
                        return rej(new Error("Database Connection is closed!"));

                    const tx = db.transaction(name, "readwrite");
                    tx.onerror = () => rej(tx.error);
                    tx.onabort = () => rej(new Error("Clear Transaction Aborted!"));

                    wrapRequest(tx.objectStore(name).clear())
                        .then(res).catch(rej);
                })
            },

            /** Get Count
             * 
             * Gets the number of entries stored in the cache.
             * 
             * @returns {Promise<number>}
             */
            count():Promise<number> {
                return new Promise((res, rej)=>{
                    if(db === null)
                        return rej(new Error("Datebase Connection is closed!"));

                    wrapRequest(db.transaction(name, "readonly").objectStore(name).getAllKeys())
                        .then(list=>res(list.length)).catch(rej);
                });
            },

            /** Entries Iterator
             * 
             * @returns {Promise<CacheIteratorK, V>}
             */
            async entries():Promise<CacheIterator<K, V>> {
                if(db === null)
                    throw new Error("Datebase Connection is closed!");

                const list = await wrapRequest<K[]>(db.transaction(name, "readonly").objectStore(name).getAllKeys() as IDBRequest<any[]>);
                let i = 0;
                const next = async() => {
                    while(i < list.length) {
                        const name = list[i++];
                        const value:V|null = (await (this as CacheStore<K, V>).get(name));
                        if(value !== null)
                            return {
                                value: [name, value] satisfies CacheIteratorValue<K, V>,
                                done: false
                            }
                    }
                    
                    return {
                        value: <any>null,
                        done: true
                    }
                    
                }

                return {
                    [Symbol.asyncIterator] (){
                        return this as CacheIterator<K, V>
                    },
                    next
                }
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