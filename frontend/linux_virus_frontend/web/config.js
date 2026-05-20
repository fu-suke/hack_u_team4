const LinuxVirusConfig = (() => {
  let config = {};

  function update(nextConfig = {}) {
    config = {
      ...config,
      ...nextConfig,
      penguinImages: {
        ...(config.penguinImages || {}),
        ...(nextConfig.penguinImages || {}),
      },
    };
  }

  function get(key, fallback = undefined) {
    return Object.prototype.hasOwnProperty.call(config, key) ? config[key] : fallback;
  }

  return {
    get,
    update,
  };
})();
