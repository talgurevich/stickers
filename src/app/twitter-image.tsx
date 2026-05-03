// Twitter card image — reuses the same renderer as opengraph-image so the
// design stays in one place. Twitter (and platforms that read both) prefers
// a dedicated `twitter:image` meta when set.
export { default } from "./opengraph-image";
export { alt, size, contentType } from "./opengraph-image";
