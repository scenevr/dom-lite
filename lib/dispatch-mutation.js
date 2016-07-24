module.exports = function dispatchMutation (el, object) {
  if (!el.ownerDocument) {
    return;
  }

  var node = el;

  while (node.parentNode) {
    if (node.onMutate) {
      node.onMutate(object);
      return true;
    }

    node = node.parentNode;
  }

  return false;
};
