export function setupExpenseTaxInputs(form: HTMLFormElement): void {
    const amountInput = form.querySelector<HTMLInputElement>('[name="amount"]');
    const taxInput = form.querySelector<HTMLInputElement>('[name="tax"]');
    const taxRateInput = form.querySelector<HTMLInputElement>('[name="tax_rate"]');

    if(!amountInput || !taxInput || !taxRateInput) {
        return;
    }

    const updateRateFromTax = (): void => {
        const amountCents = Math.round(Number(amountInput.value) * 100);
        const taxCents = Math.round(Number(taxInput.value) * 100);
        const subtotalCents = amountCents - taxCents;

        if(!Number.isFinite(subtotalCents) || subtotalCents <= 0) {
            taxRateInput.value = '';
            return;
        }

        taxRateInput.value = (taxCents / subtotalCents * 100).toFixed(2);
    };

    const updateTaxFromRate = (): void => {
        if(taxRateInput.value.trim() === '') {
            return;
        }

        const amountCents = Math.round(Number(amountInput.value) * 100);
        const taxRate = Number(taxRateInput.value);

        if(!Number.isFinite(amountCents) || amountCents < 0 || !Number.isFinite(taxRate) || taxRate < 0) {
            return;
        }

        const taxCents = Math.round(amountCents * taxRate / (100 + taxRate));

        taxInput.value = (taxCents / 100).toFixed(2);
    };

    taxInput.addEventListener('input', updateRateFromTax);
    taxRateInput.addEventListener('input', updateTaxFromRate);
    amountInput.addEventListener('input', updateTaxFromRate);
}