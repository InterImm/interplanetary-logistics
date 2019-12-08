from astropy import time

from poliastro.bodies import Earth, Mars, Sun
from poliastro.twobody import Orbit
from poliastro.maneuver import Maneuver


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
