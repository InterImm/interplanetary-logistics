export class PricingEngine {
    constructor(params) {
        this.delta_v = params.delta_v;
        this.euros_per_delta_v = params.euros_per_delta_v || (1 / 50);
    }

    _per_delta_v() {
        return this.delta_v * this.euros_per_delta_v;
    }

    price(method = 'per_delta_v') {
        const methods = {
            'per_delta_v': this._per_delta_v.bind(this)
        };

        const use_method = methods[method];
        if (!use_method) {
            throw new Error(`No method defined for : ${method}`);
        } else {
            return use_method();
        }
    }
}
