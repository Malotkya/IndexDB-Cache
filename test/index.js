import Cache from "../build/index.js";
import {test} from "./test.js";


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