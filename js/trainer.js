/**
 * RO Class Trainer
 * @copyright Copyright 2010
 * @author Edward Rudd <urkle at outoforder.cc>
 * @author Xia
 */
/*
 * This file is part of INQ Calculators.
 *
 * INQ Calculators is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * INQ Calculators is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with INQ Calculators.  If not, see <http://www.gnu.org/licenses/>.
 */
(function($) {
function lookup(obj, key, default_) {
  return obj[key] || default_;
}

function Trainer() {
  var self = this,
      encodeChars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNOPQRSTUVWXYZ",
      max_character_level = 50,
      class_type_masks = {
        'archer':0x10, 'hunter':0x11, 'marksman':0x12,
        'mage':0x20, 'conjurer':0x21, 'warlock':0x22,
        'warrior':0x40, 'barbarian':0x41, 'knight':0x42
      },
      class_types = [ 'archer', 'hunter', 'marksman', 'mage', 'conjurer', 'warlock', 'warrior', 'barbarian', 'knight' ],
      known_versions = [ '1.6.2', '1.7_beta1' ],
      class_mask = 0xF0,
      game_version = null,
      character_class = null,
      character_level = max_character_level,
      resource_path = null;

  this.config = {};

  this.load_data = function(version, klass, level_, callback_) {
    var level = $.isFunction(level_) ? null : level_,
        callback = $.isFunction(level_) ? level_ : callback_;

    set_version(version);
    set_character_class(klass);
    $.getJSON(resource_path + "/trainerdata.json", function(data, status_message) {
        set_config(data, level);
        if ($.isFunction(callback)) { callback.apply(self); }
        });
  }

  this.encode = function() {
    var code = encodeChars.charAt($.inArray(game_version, known_versions))
      + encodeChars.charAt($.inArray(character_class, class_types))
      + encodeChars.charAt(character_level - 1);

    $.each(self.config.disciplines, function(index, discipline) {
      var s, num;
      code += encodeChars.charAt(discipline.current_level);
      for (s = 1; s <= 10; s += 2) {
        num = discipline.spells[s - 1].current_level * 6
                + discipline.spells[s].current_level;
        code += encodeChars.charAt(num);
      }
      });

    return code;
  }

  this.decode = function(code, callback) {
    var version = known_versions[encodeChars.indexOf(code[0])],
        klass = class_types[encodeChars.indexOf(code[1])],
        level = encodeChars.indexOf(code[2]) + 1;

    self.load_data(version, klass, level, function() {
        var discipline_index = 0;
        $.each(self.config.disciplines, function(discipline_name, discipline) {
          self.set_discipline_level(discipline_name, encodeChars.indexOf(code[discipline_index * 6 + 3]));

          $.each(discipline.spells, function(power_index, power) {
            var offset = (discipline_index * 6) + 4 + Math.floor(power_index / 2),
            value = encodeChars.indexOf(code[offset]),
            level = null;

            if (0 == power_index % 2) {
              level = Math.floor(value / 6);
            } else {
              level = value % 6;
            }

            self.set_power_level(discipline_name, power_index + 1, level);
          });
          discipline_index++;
        });
        reset_points();
        if ($.isFunction(callback)) {
        callback.apply(self);
        }

        });
  }

  this.is_valid = function() {
    return !(self.discipline_points_left() < 0)
      && !(self.power_points_left() < 0);
  }

  this.reset_powers = function() {
    $.each(self.config.disciplines, function(discipline_name, discipline) {
        self.set_discipline_level(discipline_name, self.config.min_discipline_level);
        $.each(discipline.spells, function(index, power) {
          self.set_power_level(discipline_name, index + 1, self.config.min_power_level);
          });
        });
    reset_points();
  }

  this.set_discipline_level = function(discipline_name, level) {
    var discipline = self.config.disciplines[discipline_name];
    if (discipline) {
      discipline.current_level = Math.min(level, self.config.max_discipline_level);
      discipline.current_power_limit =
        self.config.max_power_level[discipline.current_level-1];
      reset_points();
    }
  }

  this.set_power_level = function(discipline_name, power_index, level) {
    var discipline = self.config.disciplines[discipline_name];
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
    return self.config.discipline_required_points[level-1]
      - self.config.discipline_required_points[discipline.current_level-1];
  }

  this.discipline_points_left = function() {
    return self.config.discipline_points_total - self.config.discipline_points_used;
  }

  this.power_limit = function(discipline, power_index) {
    return (discipline.current_level > power_index * 2) ? discipline.current_power_limit : self.config.min_power_level;
  }

  this.power_points_left = function() {
    return self.config.power_points_total - self.config.power_points_used;
  }

  this.set_character_level = function(level_) {
    var level = parseInt(level_);
    if (!isNaN(level)) { 
      character_level = Math.min(level, max_character_level);
    } else {
      character_level = max_character_level;
    }
    reset_limits();
    reset_points();
  }

  this.get_character_level = function() {
    return character_level;
  }

  this.get_game_version = function() {
    return game_version;
  }

  this.get_character_class = function() {
    return character_class;
  }

  function set_version(v) {
    if ($.inArray(v, known_versions) > -1) {
      game_version = v;
      resource_path = "trainer/" + game_version;
    }
  }

  function set_character_class(c_) {
    var c = c_.toLowerCase();
    if ($.inArray(c, class_types)) {
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

  function reset_points() {
    var disciplines = self.config.disciplines, dp_total = 0, pp_total = 0;

    $.each(disciplines, function(index, discipline) {
        discipline.current_level = Math.min(discipline.current_level, self.config.max_discipline_level);
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

  function get_disciplines(class_code, data) {
    var base = class_code & class_mask,
        disc = lookup(data.class_disciplines, base, []);

    if (base != class_code) {
      disc = disc.concat(lookup(data.class_disciplines, class_code, []));
    }

    return disc;
  }
}

function TrainerUI() {
  var self = this,
      edit_mode_class = 'edit_mode_control',
      view_mode_class = 'view_mode_control',
      view_mode_data = 'view_mode_data',
      mode_list_selector = '#trainer select, #tool_options select';

  this.setup = new Trainer();

  this.load_data = function(game_version, character_class, character_level, callback) {
    this.setup.load_data(game_version, character_class, character_level, function() {
      reset_ui();
      if ($.isFunction(callback)) {
        callback.apply(self);
      }
    });
  }

  this.decode = function(code, callback) {
    self.setup.decode(code, function() {
        reset_ui();
        self.reset_events();
        if ($.isFunction(callback)) { callback.apply(self) }
        });
  }

  this.set_edit_mode = function() {
    $('.' + view_mode_class).hide();
    $('.' + edit_mode_class).show();
    $('.' + view_mode_data).remove();
    $(mode_list_selector).show();
  }

  this.set_view_mode = function() {
    if (self.setup.is_valid()) {
      $('.' + view_mode_class).show();
      $('.' + edit_mode_class).hide();
      $(mode_list_selector).each(function() {
          var element = $(this), p = element.parent();
          p.append($('<span>').addClass(view_mode_data).text(element.find('option:selected').text()));
          element.hide();
          });
    } else {
      self.set_edit_mode();
    }
  }

  this.reset_powers = function(level) {
    self.setup.reset_powers();
    reset_controls();
  }

  this.set_character_level = function(level) {
    self.setup.set_character_level(level);
    reset_controls();
  }

  this.set_discipline_level = function(discipline_name, level) {
    self.setup.set_discipline_level(discipline_name, level);
    reset_controls();
  }

  this.set_power_level = function(discipline_name, power_index, level) {
    self.setup.set_power_level(discipline_name, power_index, level);
    reset_controls();
  }

  this.increase_discipline_level = function(source) {
    var discipline = $(this).parents('.metadata'),
        discipline_name = discipline.find('.name').text(),
        discipline_level = parseInt(discipline.find('.level').text());

    if ($(this).hasClass('disabled')) {
      if (discipline_level == self.setup.config.max_discipline_level) {
        self.notify_error('Discipline is at maximum level');
      } else {
        self.notify_error('Not enough discipline points');
      }
    } else {
      self.set_discipline_level(discipline_name, discipline_level + 2);
    }
  }

  this.decrease_discipline_level = function(source) {
    if ($(this).hasClass('disabled')) {
      self.notify_error('Discipline is at minimum level');
    } else {
      var discipline = $(this).parents('.metadata'),
          discipline_name = discipline.find('.name').text(),
          discipline_level = parseInt(discipline.find('.level').text());
      self.set_discipline_level(discipline_name, discipline_level - 2);
    }
  }

  this.increase_power_level = function(source) {
    var discipline_node = $(this).parents('.discipline'),
        discipline_name = discipline_node.find('.name').text(),
        discipline = self.setup.config.disciplines[discipline_name],
        power = $(this).parents('.power'),
        power_index = discipline_node.find('.power').index(power) + 1,
        power_level = parseInt(power.find('.level').text());

    if ($(power).hasClass('available')) {
      if ($(this).hasClass('disabled')) {
        if (power_level == discipline.current_power_limit) {
          self.notify_error('Power is at maximum level');
        } else {
          self.notify_error('Not enough power points');
        }
      } else {
        self.set_power_level(discipline_name, power_index, power_level + 1);
      }
    }
  }

  this.decrease_power_level = function(source) {
    var discipline = $(this).parents('.discipline'),
        discipline_name = discipline.find('.name').text();
        power = $(this).parents('.power'),
        power_index = discipline.find('.power').index(power) + 1,
        power_level = parseInt(power.find('.level').text());

    if ($(power).hasClass('available')) {
      if ($(this).hasClass('disabled')) {
        self.notify_error('Power is at minimum level');
      } else {
        self.set_power_level(discipline_name, power_index, power_level - 1);
      }
    }
  }

  this.permalink = function() {
    return window.location.protocol + '//'
      + window.location.host + window.location.pathname
      + '?s=' + self.setup.encode()
  }

  this.update_permalink = function() {
    var p = $('#permalink');
    if (self.setup.is_valid()) {
      p.show();
    } else {
      p.hide();
    }

    return p.attr('href', self.permalink());
  }

  this.reset_events = function() {
    $('.discipline .metadata .increase_level').click(self.increase_discipline_level);
    $('.discipline .metadata .decrease_level').click(self.decrease_discipline_level);
    $('.discipline .powers .increase_level').click(self.increase_power_level);
    $('.discipline .powers .decrease_level').click(self.decrease_power_level);
    $('.power').each(function(index, power) {
        $(power).cluetip({ local: true, positionBy: 'bottomTop' });
      });
    $('#cluetip-outer').addClass('ui-widget');
    $('#cluetip-title').addClass('ui-widget-header');
    $('#cluetip-inner').addClass('ui-widget-content');
    $('#trainer').fadeIn();
  }

  this.notify_error = function(message) {
    alert(message);
  }

  function reset_ui() {
    var setup = self.setup, ui = $('#trainer_ui');

    ui.empty();
    $.each(setup.config.disciplines, function(discipline_name, discipline) {
        var dword = discipline_name.replace(/ /g, '_'),
          name_block = $('<div>').addClass('name'),
          icon_block = $('<div>').addClass('icon')
            .css('background-image', "url('" + discipline.icon_path + "')")
            .append($('<div>').addClass('level')),
          control_block = $('<div>').addClass('ui-icon'),
          controls_block = $('<div>').addClass('controls')
            .addClass(edit_mode_class)
            .append(control_block.clone().addClass('increase_level ui-icon-triangle-1-n'))
            .append(control_block.clone().addClass('decrease_level ui-icon-triangle-1-s')),
          powers_block = $('<div>').addClass('powers'),
          discipline_block = $('<div>').addClass('discipline discipline_' + dword);


        discipline_block.append($('<div>').addClass('metadata')
          .append(name_block.text(discipline_name))
          .append(icon_block.clone())
          .append(controls_block.clone())
          );

        $.each(discipline.spells, function(power_index, power) {
          var pword = power.name.replace(/ /g, '_'),
              pid = dword + '-' + pword.replace(/[^A-Za-z0-9]/g, '_'),
              block = $('<div>').addClass('power p' + (power_index+1)).attr('title', power.name).attr('rel', '#' + pid);

          block.append(icon_block.clone());
          block.append(controls_block.clone());
          powers_block.append(block);
          powers_block.append(tooltip_block(power).attr('id', pid));
        });

        discipline_block.append(powers_block);
        ui.append(discipline_block);
      });

    reset_controls();
  }

  function reset_controls() {
    var setup = self.setup, metadata = $('#trainer_metadata');

    $('#char_level').val(setup.get_character_level());

    metadata.find('.discipline_points .left').text(setup.discipline_points_left());
    metadata.find('.discipline_points .total').text(setup.config.discipline_points_total);
    if (setup.discipline_points_left() < 0) {
      metadata.find('.discipline_points').addClass('invalid');
    } else {
      metadata.find('.discipline_points').removeClass('invalid');
    }

    metadata.find('.power_points .left').text(setup.power_points_left());
    metadata.find('.power_points .total').text(setup.config.power_points_total);
    if (setup.power_points_left() < 0) {
      metadata.find('.power_points').addClass('invalid');
    } else {
      metadata.find('.power_points').removeClass('invalid');
    }

    self.update_permalink();

    $('.discipline').each(function(index, element) {
        var discipline_name = $(element).find('.name').text(),
            discipline = setup.config.disciplines[discipline_name];

        $(element).find('.level').text(discipline.current_level);

        $(element).find('.metadata .ui-icon.disabled').removeClass('disabled');
        if (setup.config.min_discipline_level == discipline.current_level) {
          $(element).find('.metadata .ui-icon-triangle-1-s').addClass('disabled');
        } 
        if ((setup.config.max_discipline_level == discipline.current_level)
          || !setup.valid_discipline_level(discipline, discipline.current_level + 2)) {
          $(element).find('.metadata .ui-icon-triangle-1-n').addClass('disabled');
        }

        $(element).find('.power').each(function(power_index, element) {
          var power_position = power_index * 2 + 1;
          power_limit = setup.power_limit(discipline, power_index),
          power = discipline.spells[power_index];

          $(element).find('.level').text(power.current_level);

          /* redraw icons */
          $(element).removeClass('available activated valid invalid');
          if (power_position <= discipline.current_level) {
            $(element).addClass('available');
            if (power.current_level > 0) {
              $(element).addClass('activated');
            }
          }

          if (setup.valid_discipline_level(discipline, (power_index * 2) + 1)) {
            $(element).addClass('valid');
          } else {
            $(element).addClass('invalid');
          }

          /* redraw controls */
          $(element).find('.ui-icon.disabled').removeClass('disabled');
          if (setup.config.min_power_level == power.current_level) {
            $(element).find('.ui-icon-triangle-1-s').addClass('disabled');
          }
          if (power.current_level == power_limit || 0 >= self.setup.power_points_left()) {
            $(element).find('.ui-icon-triangle-1-n').addClass('disabled');
          }
        });
    });
  }

  function tooltip_block(power) {
    var tooltip = $('<div>').addClass('tooltip');
    tooltip.append($('<div>').addClass('description').text(power.description));
    if (power.damage) {
      tooltip.append(spec_block('Damage', power.damage).addClass('damage'));
    }

    specs = $('<div>').addClass('specs');
    specs.append(spec_block('Type', power.type || 'Unknown'));
    if (power.type && power.type != 'Passive') {
      if (power.duration) {
        specs.append(spec_block('Duration', power.duration));
      }
      specs.append(spec_block('Cost', power.mana));
      specs.append(spec_block('Casting', power.cast || 'Instant'));
      specs.append(spec_block('Cooldown', power.cooldown || 'Unknown'));
      if (power.gcd) {
        specs.append(spec_block('GCD', power.gcd || 'Unknown'));
      }
      if (power.range) {
        specs.append(spec_block('Range', power.range || 'Weapon Range'));
      }
      if (power.area) {
        specs.append(spec_block('Area', power.area));
      }
    }
    if (power.buffs) {
      specs.append(spec_block('', power.buffs).addClass('buffs'));
    }
    if (power.debuffs) {
      specs.append(spec_block('', power.debuffs).addClass('debuffs'));
    }

    tooltip.append(specs);

    return tooltip;
  }

  function spec_block(k, v) {
    var block = $('<div>'),
        name = $('<label>').text(k + ':').addClass('spec_label'),
        value = $('<div>');


    if (typeof v == 'string' || typeof v == 'number') {
      value.append(v);
    } else if ($.isArray(v)) {
      $.each($.map(v, spec_level_map), function(i, block) {
          if (i > 0) { value.append(', '); }
          value.append(block)
          });
    } else {
      name.removeClass('spec_label');
      for (spec in v) {
        if (v[spec] === true) {
          value.append(spec);
        } else {
          value.append(spec_block(spec, v[spec]));
        }
      }
    }

    if (k) { block.append(name); }
    return block.append(value);
  }

  function spec_level_map(value, index) {
    return $('<span>').addClass('l' + (index + 1)).text(value);
  }
}

var T = new TrainerUI();

$(function() {
  $('#trainer').hide();
  $('#trainer_actions a').button();

  $('#tool_option_submit').click(function() {
      if (!$('#game_version').val()) {
        $('#game_version').effect('highlight', {}, 2000);
        T.notify_error('Please select a game version.');
      } else if (!$('#char_class').val()) {
        $('#char_class').effect('highlight', {}, 2000);
        T.notify_error('Please select a character class.');
      } else if (!$('#char_level').val()) {
        $('#char_level').effect('highlight', {}, 2000);
        T.notify_error('Please select a character level.');
      } else {
        $('#trainer').hide();
        T.load_data($('#game_version').val(), $('#char_class').val(), $('#char_level').val(), T.reset_events);
      }
      return false;
    });

  $('#char_level').change(function() {
    T.set_character_level($(this).val());
    });

  $('#edit_setup').click(function() {
      T.set_edit_mode();
      return false;
      });

  $('#reset_powers').click(function() {
      T.reset_powers();
      return false;
      });

  if ($.query.get('s')) {
    T.decode($.query.get('s'), function() {
        $('#game_version').val(T.setup.get_game_version());
        $('#char_class').val(T.setup.get_character_class());
        T.set_view_mode();
      });
  } else {
    T.set_edit_mode();
  }
});

})(jQuery);
