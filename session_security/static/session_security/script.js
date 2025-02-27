// Use 'yourlabs' as namespace.
if (window.yourlabs == undefined) window.yourlabs = {};

// Session security constructor. These are the required options:
//
// - pingUrl: url to ping with last activity in this tab to get global last
//   activity time,
// - warnAfter: number of seconds of inactivity before warning,
// - expireAfter: number of seconds of inactivity before expiring the session.
//
// Optional options:
//
// - confirmFormDiscard: message that will be shown when the user tries to
//   leave a page with unsaved form data. Setting this will enable an
//   onbeforeunload handler that doesn't block expire().
// - events: a list of event types to watch for activity updates.
// - returnToUrl: a url to redirect users to expired sessions to. If this is not defined we just reload the page
yourlabs.SessionSecurity = function (options) {
  // **HTML element** that should show to warn the user that his session will
  // expire.
  this.warning = document.querySelector("#session_security_warning");

  // Last recorded activity datetime.
  this.lastActivity = new Date();

  // Events that would trigger an activity
  this.events = [
    "mousemove",
    "scroll",
    "keyup",
    "click",
    "touchstart",
    "touchend",
    "touchmove",
  ];

  // Merge the options dict here.
  Object.assign(this, options);
  

  // Bind activity events to update this.lastActivity.
  var m_document = document;
  
  
  for (var i = 0; i < this.events.length; i++) {        
    if (m_document[this.events[i]] == null) {      
      m_document.addEventListener(this.events[i], this.activity.bind(this));      
    }
  }

  // Initialize timers.
  this.apply();

  if (this.confirmFormDiscard) {
    window.onbeforeunload = this.onbeforeunload.bind(this);
    m_document.addEventListener("change", this.formChange.bind(this));
    m_document.addEventListener("submit", this.formClean.bind(this));
    m_document.addEventListener("reset", this.formClean.bind(this));
  }
};

yourlabs.SessionSecurity.prototype = {
  // Called when there has been no activity for more than expireAfter
  // seconds.
  expire: function () {    
    this.expired = true;
    if (this.returnToUrl !== undefined) {
      window.location.href = this.returnToUrl;
    } else {
      window.location.reload();
    }
  },

  // Called when there has been no activity for more than warnAfter
  // seconds.
  showWarning: function () {
    
    this.warning.removeAttribute("style", "");
    this.warning.setAttribute("aria-hidden", "false");
    document.querySelector(".session_security_modal").focus();
  },

  // Called to hide the warning, for example if there has been activity on
  // the server side - in another browser tab.
  hideWarning: function () {
     
    this.warning.setAttribute("style", "display:none");
    this.warning.setAttribute("aria-hidden", "true");
  },

  // Called by click, scroll, mousemove, keyup, touchstart, touchend, touchmove
  activity: function () {    
    var now = new Date();
    if (now - this.lastActivity < 1500)
      // Throttle these checks to once per 1.5 seconds
      return;

    var idleFor = Math.floor((now - this.lastActivity) / 1000);
    this.lastActivity = now;

    if (idleFor >= this.expireAfter) {
      // Enforces checking whether a user's session is expired. This
      // ensures a user being redirected instead of waiting until nextPing.
      this.expire();
    }
    if (!this.warning.hasAttribute('style')) {
      // Inform the server that the user came back manually, this should
      // block other browser tabs from expiring.
      this.ping();
      // The hideWarning should only be called when the warning is visible
      this.hideWarning();
    }
  },

  // Hit the PingView with the number of seconds since last activity.
  ping: function () {    
    var idleFor = Math.floor((new Date() - this.lastActivity) / 1000);    
    
    var xhr = new XMLHttpRequest();
    
    // For no cache, append _ with current timestamp.
    let xUrl = this.pingUrl + "?idleFor=" + String(idleFor) + "&_=" + String(new Date().getTime());

    xhr.open("GET", xUrl , true);
    // set header to JSON?
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    var self = this;
    var ponger = self.pong.bind(self);
    var applier = self.apply.bind(self);
    xhr.onload =  function() {
        if (xhr.readyState == xhr.DONE && xhr.status == 200)
        {
         
          ponger(xhr.response);
        }
        else if (xhr.readyState == xhr.DONE && xhr.status == 400)
        {         
          applier(xhr.response  );
        }
        else
        {          
        }            
    };      

    xhr.onerror = function(){
      console.log("Error connecting to ping view");
    }    
    xhr.send(JSON.stringify({
      idleFor: idleFor,
  }));
  },

  // Callback to process PingView response.
  pong: function (data) {     
    if (String(data) === ""logout\"") return this.expire();
    this.lastActivity = new Date();
    this.lastActivity.setSeconds(this.lastActivity.getSeconds() - data);
    this.apply();
  },

  // Apply warning or expiry, setup next ping
  apply: function () {
    // Cancel timeout if any, since we're going to make our own    
    clearTimeout(this.timeout);

    var idleFor = Math.floor((new Date() - this.lastActivity) / 1000);    
    if (idleFor >= this.expireAfter) {
      return this.expire();
    } else if (idleFor >= this.warnAfter) {
      this.showWarning();
      nextPing = this.expireAfter - idleFor;
    } else {
      this.hideWarning();
      nextPing = this.warnAfter - idleFor;
    }

    // setTimeout expects the timeout value not to exceed
    // a 32-bit unsigned int, so cap the value    
    var milliseconds = Math.min(nextPing * 1000, 2147483647);    
    this.timeout = setTimeout(this.ping.bind(this), milliseconds);
  },

  // onbeforeunload handler.
  onbeforeunload: function (e) {
    if (document.querySelector("form[data-dirty]").length && !this.expired) {
      return this.confirmFormDiscard;
    }
  },

  // When an input change, set data-dirty attribute on its form.
  formChange: function (e) {
    document.querySelector(e.target).closest("form").attr("data-dirty", true);
  },

  // When a form is submitted or resetted, unset data-dirty attribute.
  formClean: function (e) {
    document.querySelector(e.target).removeAttr("data-dirty");
  },
};