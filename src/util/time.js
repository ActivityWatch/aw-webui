import moment from 'moment';

export default {
    seconds_to_duration(seconds) {
        var result = "";
        var hrs = Math.floor(seconds/60/60);
        var min = Math.floor(seconds/60%60);
        var sec = Math.floor(seconds%60);
        if (hrs != 0)
            result += hrs + "h";
        if (hrs != 0 || min != 0)
            result += min + "m";
        if (hrs == 0)
            result += sec + "s";
        return result;
    },

    get_day_start(datestr) {
      // Get start time of date
      var datestart = moment(datestr);
      datestart.set('hour', 0);
      datestart.set('minute', 0);
      datestart.set('second', 0);
      datestart.set('millisecond', 0);
      return datestart;
    },

    get_prev_day(datestr){
      var newdate = moment(datestr).add(-1, 'days');
      return newdate;
    },

    get_next_day(datestr){
      var newdate = moment(datestr).add(1, 'days');
      return newdate;
    },
}
