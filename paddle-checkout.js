(function () {
  const config = window.FLOWBRIDGE_PADDLE || {};
  const checkoutButtons = document.querySelectorAll(".checkout-button");

  function getSelectedPlan() {
    return window.flowbridgePricingState?.selectedPlan || "solo";
  }

  function getSelectedBilling() {
    return window.flowbridgePricingState?.billing || "monthly";
  }

  function getPriceId(plan, billing) {
    return config.prices?.[plan]?.[billing];
  }

  function initPaddle() {
    if (!window.Paddle || !config.clientToken) return false;
    if (window.flowbridgePaddleReady) return true;

    window.Paddle.Initialize({
      token: config.clientToken,
    });
    window.flowbridgePaddleReady = true;
    return true;
  }

  function openCheckout(plan, billing) {
    const priceId = getPriceId(plan, billing);
    const successUrl = config.successUrl || new URL("/success", window.location.origin).toString();

    if (!priceId) {
      alert("Checkout is not ready for this plan yet.");
      return;
    }

    if (!initPaddle()) {
      alert("Paddle checkout needs the client-side token first.");
      return;
    }

    window.Paddle.Checkout.open({
      items: [
        {
          priceId,
          quantity: 1,
        },
      ],
      settings: {
        successUrl,
      },
    });
  }

  checkoutButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const plan = button.dataset.plan || getSelectedPlan();
      const billing = getSelectedBilling();
      openCheckout(plan, billing);
    });
  });
})();
