import type { UserConfig } from "vite";

const config: UserConfig = {
  server: {
    port: 5182,
    strictPort: true,
    proxy: {
      "/api/demo": "http://localhost:5181",
    },
  },
};

export default config;