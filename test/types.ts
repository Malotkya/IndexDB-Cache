/** Types Test
 * 
 * This file wont be compield / run, it is used to test if 
 * types work as expected.
 */
import Cache, {initalizeCache} from "../build";

interface User {
    name:string,
    phone:string
}

const altCache = initalizeCache("Alt");

(async()=>{
    const first = await Cache<string, User>("User");
    first.set("user_id", {
        name: "Bruton Gaster",
        phone: "867-5309"
    });

    const user = await first.get("user_id");

    const second = await Cache<number, "Suck It"|"Thats Messed Up">("Psych");
    await second.set(1, "Suck It");
    await second.set(2, "Have you heard about pluto?");

    const newFirst = await altCache<string, User>("User");
    newFirst.set("user_id", {
        name: "Magic Head",
        phone: "555-5555"
    });

    const test = (await first.get("user_id"))?.name === (await newFirst.get("user_id"))?.name;
})()