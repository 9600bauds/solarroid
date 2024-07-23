const Blueprint = require('factorio-blueprint');

Blueprint.setEntityData({
  "se_space_solar_panel":
  {
    type: 'item',
    width: 4,
    height: 4
  },
  "se_space_solar_panel_2":
  {
    type: 'item',
    width: 4,
    height: 4
  },
  "se_space_solar_panel_3":
  {
    type: 'item',
    width: 4,
    height: 4
  },
  "se_space_accumulator":
  {
    type: 'item',
    width: 2,
    height: 2
  },
  "se_space_accumulator_2":
  {
    type: 'item',
    width: 2,
    height: 2
  },
  "se_pylon_substation":
  {
    type: 'item',
    width: 2,
    height: 2,
    maxElectricReach: 64
  }
});

module.exports = Blueprint;