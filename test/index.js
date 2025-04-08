/** Browser Testing
 * 
 * Run tests by running live server in index.html
 * 
 * @author Alex Malotky
 */
import Cache, {initalizeCache} from "../build/index.js";
import {test, sleep} from "./test.js";

const alt = initalizeCache("alt");

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

    test("Remove Value Test", async()=>{
        const cache = await Cache("Second");
        cache.remove(12);
    });

    test("Clear Values Test", async()=>{
        const cache = await Cache("Empty");
        await cache.set(1, "One");
        await cache.set(2, "Two");
        await cache.clear();

        if(0 !== await cache.count())
            throw new Error("Cache is not empty!");        
    });

    test("Seperate Cache Test", async()=>{
        const first = await Cache("Test");
        const second = await alt("Test", {defaultTtl: -1});

        first.set("id", "This is stored in the default Cache");
        second.set("id", "This is stored in the alternative Cache");

        return (await first.get("id")) === (await second.get("id"));
    });

    test("TTL Test", async()=>{
        const cache = await alt("TTL");
        const output = [];
        const ttl = 100;

        const start = Date.now();
        await cache.set("key", "value", ttl);
        
        output.push(`${Date.now() - start}: ${await cache.get("key")}`);
        await sleep(ttl);

        output.push(`${Date.now() - start}: ${await cache.get("key")}`);
        return output;
    });

    test("TTL Error", (done, error)=>{
        alt("TTL").then(cache=>{
            cache.set("key", "value").then(()=>{
                error("No error occured!");
            }).catch(e=>{
                done(e.message || String(e));
            })
        }).catch(error);
    });

    test("Closed Error", (done, error)=>{
        alt("Test").then(cache=>{
            cache.close();
            cache.set("key", "value").then(()=>{
                error("No error occured!");
            }).catch(e=>{
                done(e.message || String(e));
            })
        }).catch(error);
    });

    test("Loop Test", async()=>{
        const cache = await Cache("Test");
        const output = [];

        await cache.set(1, "One");
        await cache.set(2, "Two");
        await cache.set(3, "Three");
        await cache.set(4, "Four");
        await cache.set(5, "Five");

        output.push("First Loop:")
        for await(const [key, value] of await cache.entries())
            output.push(`${key}: ${value}`);

        await cache.set("Six", 6);
        await cache.set("Seven", 7);
        await cache.set("Eight", 8);
        await cache.set("Nine", 9);
        await cache.set("Ten", 10);

        output.push("Second Loop:")
        for await(const [key, value] of await cache.entries())
            output.push(`${key}: ${value}`);

        return output;
    })
})()

