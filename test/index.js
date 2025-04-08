import Cache from "../build/index.js";
import {test} from "./test.js";

(async()=>{
    for(const name of await indexedDB.databases()) {
        indexedDB.deleteDatabase(name);
    }

    test("Init Cache Test", async()=>{
        const cache = await Cache("Test");
        cache.close();
    });
    
    test("Get/Set Value Test", async()=>{
        const cache = await Cache("Test");
        await cache.set("Key", {message: "Hello World!"})
        const result = await cache.get("Key");
        return result.message;
    });
    
    test("Second Store", async()=>{
        const cache = await Cache("Second");
        cache.set(12, "Successful!");
    });
    
})()

