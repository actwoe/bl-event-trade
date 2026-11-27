'use client';

import { useEffect } from 'react';

export function BuyMeACoffeeWidget() {
  useEffect(() => {
    const existingWidget = document.getElementById('bmc-wbtn');
    if (existingWidget) return;

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-name="BMC-Widget"]',
    );

    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.setAttribute('data-name', 'BMC-Widget');
    script.setAttribute('data-cfasync', 'false');
    script.src = 'https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js';
    script.setAttribute('data-id', 'beautifulover');
    script.setAttribute('data-description', 'Support me on Buy me a coffee!');
    script.setAttribute('data-message', '');
    script.setAttribute('data-color', '#FFED75');
    script.setAttribute('data-position', 'Right');
    script.setAttribute('data-x_margin', '18');
    script.setAttribute('data-y_margin', '18');
    script.async = true;

    script.onload = () => {
      window.dispatchEvent(new Event('DOMContentLoaded'));
    };

    document.body.appendChild(script);

    return () => {
      script.remove();
      document.getElementById('bmc-wbtn')?.remove();
    };
  }, []);

  return null;
}
