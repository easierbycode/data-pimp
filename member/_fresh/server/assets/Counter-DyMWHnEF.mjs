import { e as escape_html } from "./escaping-ukrAy0Ul.mjs";
import "./base64-rR4j1CBY.mjs";
function Counter($$renderer, $$props) {
  let { initial = 0, label = "Svelte counter" } = $$props;
  let count = initial;
  $$renderer.push(`<div class="svelte-counter svelte-cjvmuf"><div class="svelte-counter__label svelte-cjvmuf">${escape_html(label)}</div> <div class="svelte-counter__row svelte-cjvmuf"><button type="button" aria-label="decrement" class="svelte-cjvmuf">−</button> <span class="svelte-counter__value svelte-cjvmuf">${escape_html(count)}</span> <button type="button" aria-label="increment" class="svelte-cjvmuf">+</button></div> <p class="svelte-counter__hint svelte-cjvmuf">Rendered by Svelte 5 (runes). Mounted by a Preact island wrapper.</p></div>`);
}
export {
  Counter as default
};
