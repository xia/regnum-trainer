function lookup(obj, key, default_) {
  return obj[key] || default_;
}

function Trainer() {
  var self = this,
      max_character_level = 50,
      class_type_masks = {
        'archer':0x10, 'hunter':0x11, 'marksman':0x12,
        'mage':0x20, 'conjurer':0x21, 'warlock':0x22,
        'warrior':0x40, 'barbarian':0x41, 'knight':0x42
      },
      known_versions = [ '1.6.2', '1.7_beta1' ],
      class_mask = 0xF0,
      game_version = null,
      character_class = null,
      character_level = max_character_level,
      resource_path = null;

  this.config = {};

  this.load_data = function(version, klass, level) {
    var self = this;
    set_version(version);
    set_character_class(klass);
    $.getJSON(resource_path + "/trainerdata.json", function(data, status_message) {
        set_config(data, level);
        });
  }

  function set_version(v) {
    if ($.inArray(v, known_versions) > -1) {
      game_version = v;
      resource_path = "trainer/" + game_version;
    }
  }

  function set_character_class(c) {
    var c = c.toLowerCase();
    if ($.inArray(c, Object.keys(class_type_masks))) {
      character_class = c;
    }
  }

  function get_value_by_mask(collection, key) {
    for (mask in collection) {
      if ((parseInt(mask) & key) > 0) {
        return collection[mask];
      }
    }
  }

  function set_config(data, level) {
    console.log(data);
    var class_code = lookup(class_type_masks, character_class, 0),
        c = {
          'discipline_points_per_level':
            get_value_by_mask(data.points.discipline, class_code),
          'discipline_points_used': 0,
          'power_points_per_level':
            get_value_by_mask(data.points.power, class_code),
          'power_points_used': 0,
          'min_discipline_level': 1,
          'min_power_level': data.min_power_level,
          'max_power_level': data.required.power,
          'discipline_required_points': data.required.points,
          'discipline_required_character_level': data.required.level,
          'disciplines': {}
        }

    $.each(get_disciplines(class_code, data), function(discipline_index, discipline_name) {
        var discipline = data.disciplines[discipline_name];

        $.each(discipline.spells, function(power_index, power) {
          $.extend(power, { 'current_level': c.min_power_level });
          });

        $.extend(discipline, { 
          'current_level': c.min_discipline_level,
          'current_power_limit': c.max_power_level[c.min_discipline_level-1],
          'icon_path': resource_path + '/icons/' + discipline_name.replace(/ /g, '') + '.jpg'
          });

        c.disciplines[discipline_name] = discipline;

        });

    self.config = c;
    self.set_character_level(level);
  }

  function get_disciplines(class_code, data) {
    var base = class_code & class_mask,
        disc = lookup(data.class_disciplines, base, []);

    if (base != class_code) {
      disc = disc.concat(lookup(data.class_disciplines, class_code, []));
    }

    return disc;
  }

  function reset_points() {
    var disciplines = self.config.disciplines, dp_total = 0, pp_total = 0;

    $.each(disciplines, function(index, discipline) {
        dp_total += self.config.discipline_required_points[discipline.current_level-1];
        $.each(discipline.spells, function(power_index, power) {
          power.current_level = Math.min(power.current_level, self.power_limit(discipline, power_index));
          pp_total += (power.current_level - self.config.min_power_level);
          });
        });

    self.config.discipline_points_used = dp_total;
    self.config.power_points_used = pp_total;
  }

  function reset_limits() {
    var c = self.config;
    c.discipline_points_total = c.discipline_points_per_level[character_level-1];
    c.power_points_total = c.power_points_per_level[character_level-1];
    c.max_discipline_level = 19;
    while (character_level < c.discipline_required_character_level[c.max_discipline_level-1]) {
      c.max_discipline_level -= 2;
    }
  }

  this.power_limit = function(discipline, power_index) {
    return (discipline.current_level > power_index * 2) ? discipline.current_power_limit : self.config.min_power_level;
  }

  this.reset_powers = function() {
    $.each(config.disciplines, function(index, discipline) {
        this.set_discipline_level(discipline.name, config.min_discipline_level);
        $.each(discipline.spells, function(index, power) {
          this.set_power_level(discipline.name, index + 1, config.min_power_level);
          });
        });
    reset_points();
  }

  this.set_discipline_level = function(discipline_name, level) {
    var discipline = this.config.disciplines[discipline_name];
    if (discipline) {
      discipline.current_level = Math.min(level, this.config.max_discipline_level);
      discipline.current_power_limit =
        this.config.max_power_level[discipline.current_level-1];
      reset_points();
    }
  }

  this.set_power_level = function(discipline_name, power_index, level) {
    var discipline = this.config.disciplines[discipline_name];
    if (discipline) {
      power = discipline.spells[power_index-1];
      power.current_level = Math.min(level, discipline.current_power_limit);
      reset_points();
    }
  }

  this.valid_discipline_level = function(discipline, level) {
    return character_level >= self.config.discipline_required_character_level[level-1]
      && self.discipline_point_cost(discipline, level) <= self.discipline_points_left()
      && self.config.min_discipline_level <= level
      && level <= self.config.max_discipline_level;
  }

  this.discipline_point_cost = function(discipline, level) {
    return this.config.discipline_required_points[level-1]
      - this.config.discipline_required_points[discipline.current_level-1];
  }

  this.discipline_points_left = function() {
    return this.config.discipline_points_total - this.config.discipline_points_used;
  }

  this.set_character_level = function(level) {
    var level = parseInt(level);
    if (!isNaN(level)) { 
      character_level = Math.min(level, max_character_level);
      reset_limits();
    }
  }

  this.get_character_level = function() {
    return character_level;
  }
}
