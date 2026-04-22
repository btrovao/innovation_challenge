"""
Continental Portugal (mainland) bounding box in WGS84.

Excludes Azores, Madeira, and outer islands by design. Adjust if you need a tighter
polygon clip (use a shapefile + rioxarray in addition to this bbox).
"""

# Continental Portugal extent (WGS84, decimal degrees)
# Expanded envelope to fully cover the mainland outline used by the app
# (prevents west/north edge municipalities such as Cascais from falling outside).
MAINLAND_SOUTH = 36.824083
MAINLAND_NORTH = 42.280469
MAINLAND_WEST = -9.526571
MAINLAND_EAST = -6.034389
