(function WalchPizza() {
  const cannotHover = matchMedia('(hover: none)').matches;
  console.log({cannotHover});
  if (cannotHover) {
    setTimeout(function() {
      const elements = document.getElementsByClassName('rnOuter');
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        console.log('before', {element});
        element.classList.add('opened');
        console.log('after', {element});
      }
    }, 6000);
  }
}());    