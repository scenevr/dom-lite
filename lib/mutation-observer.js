// todo - maybe use defer?
var debounce = require('lodash.debounce');

function MutationObserver (callback) {
  if (!callback) {
    throw new Error('Must specify a callback');
  }

  this.callback = debounce(() => {
    callback(this.mutations);
    this.mutations = [];
  }, 0);

  this.mutations = [];
}

MutationObserver.prototype.observe = function (target) {
  var self = this;

  if (target.nodeName !== '#document') {
    throw new Error('Can only observe document');
  }

  target.onMutate = function (mutation) {
    var lastMutation = self.mutations[self.mutations.length - 1];

    if (lastMutation && (mutation.type === 'childList') && (lastMutation.type === 'childList') && (mutation.target === lastMutation.target)) {
      lastMutation.addedNodes = lastMutation.addedNodes.concat(mutation.addedNodes);
      lastMutation.removedNodes = lastMutation.removedNodes.concat(mutation.removedNodes);
    } else {
      self.mutations.push(mutation);
    }

    self.callback();
  };
};

module.exports = MutationObserver;
