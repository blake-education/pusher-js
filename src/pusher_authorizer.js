;(function() {
  Pusher.Channel.Authorizer = function(channel, options) {
    this.channel = channel;
    this.type = options.authTransport;

    this.options = options;
    this.authOptions = (options || {}).auth || {};
  };

  Pusher.Channel.Authorizer.prototype = {
    composeQuery: function(socketId) {
      var query = 'socket_id=' + encodeURIComponent(socketId) +
        '&channel_name=' + encodeURIComponent(this.channel.name);

      for(var i in this.authOptions.params) {
        query += "&" + encodeURIComponent(i) + "=" + encodeURIComponent(this.authOptions.params[i]);
      }

      return query;
    },

    authorize: function(socketId) {
      return Pusher.authorizers[this.type].call(this, socketId);
    }
  };

  var nextAuthCallbackID = 1;

  Pusher.auth_callbacks = {};
  Pusher.authorizers = {
    ajax: function(socketId) {
      var promise = new RSVP.Promise(function(resolve, reject) {
        var self = this, xhr, promise;

        if (Pusher.buildXHR) {
          xhr = Pusher.buildXHR();
        } else if (Pusher.XHR) {
          xhr = new Pusher.XHR();
        } else {
          xhr = (window.XMLHttpRequest ? new window.XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP"));
        }

        xhr.open("POST", self.options.authEndpoint, true);

        // add request headers
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        for(var headerName in this.authOptions.headers) {
          xhr.setRequestHeader(headerName, this.authOptions.headers[headerName]);
        }

        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            if (xhr.status === 200) {
              var data, parsed = false;

              try {
                data = JSON.parse(xhr.responseText);
                parsed = true;
              } catch (e) {
                reject({msg: 'JSON returned from webapp was invalid, yet status code was 200. Data was: ' + xhr.responseText});
              }

              if (parsed) { // prevents double execution.
                resolve(data);
              }
            } else {
              Pusher.warn("Couldn't get auth info from your webapp", xhr.status);
              reject({msg: xhr.status, data: data});
            }
          }
        };

        xhr.send(this.composeQuery(socketId));
      };

      return promise;
    },

    jsonp: function(socketId) {
      if(this.authOptions.headers !== undefined) {
        Pusher.warn("Warn", "To send headers with the auth request, you must use AJAX, rather than JSONP.");
      }

      var promise = new RSVP.Promise(function(resolve, reject) {

        var callbackName = nextAuthCallbackID.toString();
        nextAuthCallbackID++;

        var document = Pusher.Util.getDocument();
        var script = document.createElement("script");
        // Hacked wrapper.
        Pusher.auth_callbacks[callbackName] = function(data) {
          resolve(data);
        };

        var callback_name = "Pusher.auth_callbacks['" + callbackName + "']";
        script.src = this.options.authEndpoint +
          '?callback=' +
          encodeURIComponent(callback_name) +
          '&' +
          this.composeQuery(socketId);

        var head = document.getElementsByTagName("head")[0] || document.documentElement;
        head.insertBefore( script, head.firstChild );
      }

      return promise;
    };
  };
}).call(this);
