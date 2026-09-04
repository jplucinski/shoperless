/// <reference path="../.astro/types.d.ts" />

interface Window {
  Furgonetka?: {
    Checkout: {
      init: (configuration: {
        checkoutUuid: string;
        defaultButtonContainer: string;
        dataProviderCallback: () => Promise<unknown>;
      }) => void;
    };
  };
}
