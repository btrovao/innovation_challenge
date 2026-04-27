/** Embedded data for file:// compatibility — mirrored in *.json for tooling */
window.PORTUGAL_MVP_DATA = {
  municipalities: {
    meta: {
      region: "Portugal",
      hazards: ["heat", "flood", "wildfire", "drought", "coastal_storm"],
    },
    list: [],
  },
};

window.PORTUGAL_MVP_DATA.municipalities.list = [
  {"id":"1106","name":"Lisboa","district":"Lisboa","lat":38.7223,"lon":-9.1393,"hazards":{"heat":0.72,"flood":0.45,"wildfire":0.25,"drought":0.35,"coastal_storm":0.55}},
  {"id":"1308","name":"Porto","district":"Porto","lat":41.1579,"lon":-8.6291,"hazards":{"heat":0.55,"flood":0.42,"wildfire":0.38,"drought":0.30,"coastal_storm":0.48}},
  {"id":"0605","name":"Coimbra","district":"Coimbra","lat":40.2033,"lon":-8.4103,"hazards":{"heat":0.68,"flood":0.55,"wildfire":0.62,"drought":0.48,"coastal_storm":0.22}},
  {"id":"0811","name":"Faro","district":"Faro","lat":37.0194,"lon":-7.9322,"hazards":{"heat":0.85,"flood":0.35,"wildfire":0.58,"drought":0.62,"coastal_storm":0.42}},
  {"id":"0402","name":"Bragança","district":"Bragança","lat":41.8058,"lon":-6.7572,"hazards":{"heat":0.58,"flood":0.38,"wildfire":0.72,"drought":0.55,"coastal_storm":0.15}},
  {"id":"1823","name":"Viseu","district":"Viseu","lat":40.6566,"lon":-7.9139,"hazards":{"heat":0.65,"flood":0.48,"wildfire":0.68,"drought":0.52,"coastal_storm":0.18}},
  {"id":"0505","name":"Castelo Branco","district":"Castelo Branco","lat":39.8222,"lon":-7.4931,"hazards":{"heat":0.78,"flood":0.42,"wildfire":0.75,"drought":0.68,"coastal_storm":0.12}},
  {"id":"0704","name":"Évora","district":"Évora","lat":38.5714,"lon":-7.9135,"hazards":{"heat":0.88,"flood":0.28,"wildfire":0.55,"drought":0.75,"coastal_storm":0.10}},
  {"id":"0312","name":"Aveiro","district":"Aveiro","lat":40.6405,"lon":-8.6538,"hazards":{"heat":0.60,"flood":0.52,"wildfire":0.45,"drought":0.38,"coastal_storm":0.50}},
  {"id":"0308","name":"Leiria","district":"Leiria","lat":39.7436,"lon":-8.8071,"hazards":{"heat":0.70,"flood":0.48,"wildfire":0.65,"drought":0.50,"coastal_storm":0.38}},
  {"id":"0810","name":"Loulé","district":"Faro","lat":37.1377,"lon":-8.0197,"hazards":{"heat":0.82,"flood":0.32,"wildfire":0.52,"drought":0.58,"coastal_storm":0.40}},
  {"id":"0105","name":"Braga","district":"Braga","lat":41.5454,"lon":-8.4265,"hazards":{"heat":0.52,"flood":0.40,"wildfire":0.48,"drought":0.35,"coastal_storm":0.28}},
  {"id":"1312","name":"Vila Nova de Gaia","district":"Porto","lat":41.1239,"lon":-8.6118,"hazards":{"heat":0.54,"flood":0.44,"wildfire":0.36,"drought":0.32,"coastal_storm":0.46}},
  {"id":"1114","name":"Sintra","district":"Lisboa","lat":38.8029,"lon":-9.3817,"hazards":{"heat":0.68,"flood":0.52,"wildfire":0.48,"drought":0.40,"coastal_storm":0.42}},
  {"id":"0914","name":"Funchal","district":"Madeira","lat":32.6669,"lon":-16.9241,"hazards":{"heat":0.48,"flood":0.58,"wildfire":0.42,"drought":0.25,"coastal_storm":0.35}}
];

window.MEASURES = {"lanes":["early_warnings","early_action","disaster_preparedness","climate_adaptation"],"measures":[
  {"id":"ew-1","lane":"early_warnings","hazards":["heat","wildfire","drought"],"title":"IPMA and municipal alerts","desc":"Subscribe to IPMA weather warnings and your municipality’s channels (SMS/app)."},
  {"id":"ew-2","lane":"early_warnings","hazards":["flood","coastal_storm"],"title":"Flood and coastal alerts","desc":"Follow APA and Civil Protection warnings; set personal thresholds."},
  {"id":"ea-1","lane":"early_action","hazards":["heat"],"title":"48-hour heat plan","desc":"Hydration, outdoor timing, cool spaces, check in with your support network."},
  {"id":"ea-2","lane":"early_action","hazards":["wildfire"],"title":"Evacuation and safe routes","desc":"Know alternate routes; keep documents ready; follow authority orders."},
  {"id":"ea-3","lane":"early_action","hazards":["flood"],"title":"Raise belongings and cut power","desc":"Move items to upper floors; switch off electricity if water enters."},
  {"id":"dp-1","lane":"disaster_preparedness","hazards":["heat","wildfire","flood","drought","coastal_storm"],"title":"Emergency kit and contacts","desc":"Water, medication, documents, charger, list of trusted contacts."},
  {"id":"dp-2","lane":"disaster_preparedness","hazards":["wildfire","flood"],"title":"Insurance and inventory","desc":"Review multi-risk cover; photograph belongings; store policies in the cloud."},
  {"id":"ca-1","lane":"climate_adaptation","hazards":["heat"],"title":"Improve home thermal comfort","desc":"Shade windows, cross-ventilation, insulation; consider heat pump with grants."},
  {"id":"ca-2","lane":"climate_adaptation","hazards":["flood","coastal_storm"],"title":"Barriers and damp-proofing","desc":"Non-return valves, raise critical equipment, drainage."},
  {"id":"ca-3","lane":"climate_adaptation","hazards":["wildfire","drought"],"title":"Support network and climate literacy","desc":"Neighbourhood networks; Civil Protection training; save water during droughts."}
]};

window.EXAMPLE_PROFILES = {"profiles":[
  {"id":"maximum-risk-stress","label":"Maximum risk stress-test profile","form":{"ageBand":"65+","sex":"f","education":"basic","incomeBand":"low","housingType":"house","floorLevel":"ground","hasAC":false,"hasCoolRoomAccess":false,"occupation":"rural","outdoorWork":true,"livesAlone":true,"socialSupport":"low","healthChronic":"respiratory","mobility":"limited","insurance":false,"digitalAccess":"basic"}},
  {"id":"senior-respiratory-low","label":"Older adult, low income, no AC, respiratory condition, limited mobility","form":{"ageBand":"65+","sex":"m","education":"basic","incomeBand":"low","housingType":"apartment","floorLevel":"mid","hasAC":false,"hasCoolRoomAccess":false,"occupation":"retired","outdoorWork":false,"livesAlone":true,"socialSupport":"low","healthChronic":"respiratory","mobility":"limited","insurance":false,"digitalAccess":"basic"}},
  {"id":"outdoor-worker-insured","label":"Outdoor worker, medium income, house with AC, full mobility","form":{"ageBand":"35-49","sex":"m","education":"secondary","incomeBand":"medium","housingType":"house","floorLevel":"ground","hasAC":true,"hasCoolRoomAccess":true,"occupation":"outdoor","outdoorWork":true,"livesAlone":false,"socialSupport":"medium","healthChronic":"none","mobility":"full","insurance":true,"digitalAccess":"good"}},
  {"id":"rural-cardiovascular","label":"Rural / forestry work, cardiovascular condition, strong social ties","form":{"ageBand":"50-64","sex":"m","education":"secondary","incomeBand":"medium","housingType":"house","floorLevel":"ground","hasAC":false,"hasCoolRoomAccess":true,"occupation":"rural","outdoorWork":true,"livesAlone":false,"socialSupport":"high","healthChronic":"cardiovascular","mobility":"full","insurance":true,"digitalAccess":"basic"}},
  {"id":"young-indoor-urban","label":"Young adult, higher education, apartment, indoor work","form":{"ageBand":"18-34","sex":"f","education":"higher","incomeBand":"medium","housingType":"apartment","floorLevel":"high","hasAC":false,"hasCoolRoomAccess":true,"occupation":"indoor","outdoorWork":false,"livesAlone":true,"socialSupport":"medium","healthChronic":"none","mobility":"full","insurance":false,"digitalAccess":"good"}},
  {"id":"outdoor-low-support","label":"Outdoor job, low income, weak support, no home cooling","form":{"ageBand":"35-49","sex":"m","education":"secondary","incomeBand":"low","housingType":"apartment","floorLevel":"low","hasAC":false,"hasCoolRoomAccess":false,"occupation":"outdoor","outdoorWork":true,"livesAlone":false,"socialSupport":"low","healthChronic":"none","mobility":"full","insurance":false,"digitalAccess":"good"}},
  {"id":"affluent-indoor-secure","label":"Higher income, insured, indoor work, strong support network","form":{"ageBand":"50-64","sex":"f","education":"higher","incomeBand":"high","housingType":"house","floorLevel":"mid","hasAC":true,"hasCoolRoomAccess":true,"occupation":"indoor","outdoorWork":false,"livesAlone":false,"socialSupport":"high","healthChronic":"none","mobility":"full","insurance":true,"digitalAccess":"good"}}
]};
