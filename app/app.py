import numpy as np
from orbit_engine.lambert import get_easy_orbit, total_delta_v
from pricing_engine.engine import PricingEngine

from flask import Flask, request

app = Flask(__name__)

@app.route('/price')
def query_price():

    launch_time = request.args.get('departure_at')
    arrival_time = request.args.get('arrival_at')

    easy_orbit = get_easy_orbit(launch_time, arrival_time)

    delta_v = total_delta_v(
        easy_orbit.get('launch_time'),
        easy_orbit.get('arrivial_time')
    )

    parameters = {
        'delta_v': delta_v.get('delta_v')
    }

    pe = PricingEngine(parameters)

    res = {
        'departure_at': launch_time,
        'arrival_at': arrival_time,
        'actual_launch_at': easy_orbit.get('launch_time'),
        'actual_arrival_at': easy_orbit.get('arrivial_time'),
        'euros_per_kg': int(pe.price())
    }

    return res

@app.route('/')
def index():
    return {
        'developed_by': 'Interplanetary Immigration Center',
        'endpoints': [
            {
                'endpoint': '/price',
                'description': 'Get price estimation of the shipment, given departure_at and arrival_at; e.g., http://127.0.0.1:5000/price?departure_at=2019-01-01&arrival_at=2020-05-01'
            }
        ]
    }


if __name__ == "__main__":
    # app.run(debug=True, port=5000)
    app.run(threaded=True, port=5000)
