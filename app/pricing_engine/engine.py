

class PricingEngine():
    def __init__(self, params):
        """Initialize pricing engine

        params specifies the parameters to be used to determine the price of the shipment.

        1. delta_v is in unit of km/s
        2. euros_per_delta_v is the cost for each km/s
        """
        self.delta_v = params.get('delta_v')
        self.euros_per_delta_v = params.get('euros_per_delta_v') or 1/50

    def _per_delta_v(self):

        return self.delta_v * self.euros_per_delta_v

    def price(self, method=None):
        """Calculate the price
        """
        if method is None:
            method = 'per_delta_v'

        methods = {
            'per_delta_v': self._per_delta_v
        }

        use_method = methods.get(method)
        if not use_method:
            raise Exception('No method defined for : {}'.format(use_method))
        else:
            euros = use_method()
            return euros

