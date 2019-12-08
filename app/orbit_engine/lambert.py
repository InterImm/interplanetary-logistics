import datetime

import numpy as np
from astropy import time

from poliastro.bodies import Earth, Mars, Sun
from poliastro.maneuver import Maneuver
from poliastro.plotting.porkchop import porkchop
from poliastro.twobody import Orbit
from poliastro.util import time_range


def total_delta_v(launch, arrival):
    """Calculate the total delta v for specific combination of launch date and arrival date

    :param launch: launch time in isoformat string
    :param arrival: desired arrival time in isoformat string
    """

    date_launch = time.Time(launch, scale="utc")
    date_arrival = time.Time(arrival, scale="utc")

    ss_earth = Orbit.from_body_ephem(Earth, date_launch)
    ss_mars = Orbit.from_body_ephem(Mars, date_arrival)

    man_lambert = Maneuver.lambert(ss_earth, ss_mars)

    return {
        'delta_v': man_lambert.get_total_cost().value,
        'total_seconds': man_lambert.get_total_time().value
    }


def get_easy_orbit(launch_time, arrival_time):
    """
    get_easy_orbit
    """

    launch_span = time_range(launch_time, end=arrival_time)
    launch_time_plus_one_day = (
        datetime.datetime.strptime(launch_time, '%Y-%m-%d') + datetime.timedelta(days=1)
    ).date().isoformat()

    arrival_span = time_range(launch_time_plus_one_day, end=arrival_time)

    dv_dpt, dv_arr, c3dpt, c3arr, tof = porkchop(
        Earth, Mars, launch_span, arrival_span
    )

    opt_arr_time_idx, opt_dpt_time_idx = np.unravel_index(
        np.nanargmin(c3arr, axis=None), c3arr.shape
    )

    opt_dpt_time = launch_span[opt_dpt_time_idx].value
    opt_arr_time = arrival_span[opt_arr_time_idx].value

    return {
        'launch_time': opt_dpt_time.split(' ')[0],
        'arrivial_time': opt_arr_time.split(' ')[0]
    }



if __name__ == "__main__":

    launch_span = time_range("2020-01-01", end="2020-12-30")
    arrival_span = time_range("2020-07-01", end="2021-12-30")

    easy_orbit = get_easy_orbit("2020-01-01", "2021-07-01")

    print(
        easy_orbit,
        total_delta_v(
            easy_orbit.get('launch_time'),
            easy_orbit.get('arrivial_time')
        )
    )

    print('End of Game')