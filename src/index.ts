/** IndexDB-Cache
 * 
 * @author Alex Malotky
 */

/** Cache Store Item
 * 
 */
interface CacheStoreItem<T> {
    value: T,
    ttl: number
}

/** UpgradeDatabaseFunction
 * 
 */
type UpgradeDatabaseFunction = (db:IDBDatabase)=>Promise<void>|void

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

/** Open Database Wrapper Function
 * 
 */
function openDB(name:string):Promise<IDBDatabase>
function openDB(name:string, version:number, upgrade:UpgradeDatabaseFunction):Promise<IDBDatabase>
function openDB(name:string, version?:number, upgrade?:UpgradeDatabaseFunction):Promise<IDBDatabase> {
    return new Promise((res, rej)=>{
        const req = indexedDB.open(name, version);
        req.onblocked = () => rej(new Error("IDBDatabase 'Open Database' Blocked!"));
        req.onerror   = () => rej(req.error);
        req.onsuccess = () => res(req.result);

        if(upgrade)
            req.onupgradeneeded = async(event) => await upgrade(req.result);
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