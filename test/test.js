/** test.js
 * 
 * @author Alex Malotky
 */
const target = document.body;

/** Wrap Test In Promise
 * 
 * @param {(done:(result:string|string[]|undefined)=>void, error:(e:any)=>void)=>string[]|string|undefined|Promise<string[]|string|undefined>} fun
 * @param {number} timeout
 * @returns {Promise<string[]|string>} 
 */
function wrap(fun, timeout) {
    return new Promise((res, rej)=>{
        let id;
        const done = (result) => {
            if(id)
                window.clearTimeout(id);

            if(result) {
                res(result);
            } else {
                res("Complete!");
            }
        }

        const error = (reason) => {
            if(id)
                window.clearTimeout(id);

            if(reason instanceof Error) {
                rej(reason.message);
            } else {
                rej(String(reason));
            }
        }

        if(timeout) {
            id = window.setTimeout(()=>{
                rej("Test Timed Out!")
            }, timeout);
        }
        
        try {
            const promiseOrResult = fun(done, error);
            if(promiseOrResult instanceof Promise) {
                promiseOrResult.then(done).catch(error);
            } else if(promiseOrResult || fun.length === 0) {
                done(promiseOrResult);
            }
        } catch (e){
            error(e);
        }
    });
}

/** Run Test
 * 
 * @param {string} name 
 * @param {Function} fun 
 * @param {number} timeout
 */
export function test(name, fun, timeout) {
    const section = document.createElement("section");
    target.appendChild(section);

    const header = document.createElement("h2");
    header.textContent = name;
    section.appendChild(header);

    wrap(fun, timeout).then(result=>{
        if(Array.isArray(result)) {
            const list = document.createElement("ul");
            section.appendChild(list);

            for(let v of result){
                const item = document.createElement("li");
                item.textContent = v;
                list.appendChild(item);
            }
        } else {
            const item = document.createElement("p");
            item.textContent = result;
            section.appendChild(item);
        }
    }).catch(e => {
        console.error(e);
        const item = document.createElement("p");
        item.style.color = "red";
        item.textContent = `Error: ${e}`;
        section.appendChild(item);
    });
}