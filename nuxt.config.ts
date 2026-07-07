export default defineNuxtConfig({
  compatibilityDate: "2024-09-01",
  devtools: { enabled: true },
  ssr: true, // rendering itself is client-only via <ClientOnly> in pages/index.vue — see note there
  modules: ["@pinia/nuxt", "@vueuse/nuxt", "@nuxtjs/tailwindcss"],
  css: ["~/assets/css/tokens.css"],
  typescript: {
    strict: true,
  },
});
