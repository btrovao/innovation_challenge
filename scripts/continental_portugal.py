"""
Continental Portugal (mainland) bounding box in WGS84.

Excludes Azores, Madeira, and outer islands by design. Adjust if you need a tighter
polygon clip (use a shapefile + rioxarray in addition to this bbox).
"""

# Approximate mainland extent (degrees)
MAINLAND_SOUTH = 36.95
MAINLAND_NORTH = 42.22
MAINLAND_WEST = -9.62
MAINLAND_EAST = -6.05
