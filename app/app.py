import numpy as np
from orbit_engine.lambert import get_easy_orbit, total_delta_v
from pricing_engine.engine import PricingEngine






if __name__ == "__main__":

    easy_orbit = get_easy_orbit("2020-01-01", "2021-07-01")

    delta_v = total_delta_v(
        easy_orbit.get('launch_time'),
        easy_orbit.get('arrivial_time')
    )

    print(
        easy_orbit,
        delta_v
    )

    parameters = {
        'delta_v': delta_v.get('delta_v')
    }

    pe = PricingEngine(parameters)

    print(
        'price: ',
        pe.price()
    )

    print('End of Game')
