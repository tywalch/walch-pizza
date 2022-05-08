type App = {
  el: {
    curtains: HTMLCollectionOf<Element>;
    neonSign: Element;
    splash: Element;
  }
  nav: {
    toWedding: () => void;
  },
  actions: {
    openCurtains: () => void;
    enterTheMagic: () => void;
  }
}

(function WalchPizza() {
  const app: App = {
    el: {
      curtains: document.getElementsByClassName('rnOuter'),
      neonSign: document.getElementsByClassName('neonSign')[0],
      splash: document.getElementsByClassName('performance')[0],
    },
    nav: {
      toWedding: () => {
        const url = new URL(window.location.href);
        url.pathname = '/wedding.html';
        window.location.href = url.toString();
      }
    },
    actions: {
      openCurtains() {
        for (let i = 0; i < app.el.curtains.length; i++) {
          const element = app.el.curtains[i];
          element.classList.add('opened');
        }
      },
      enterTheMagic() {
        app.nav.toWedding();
      }
    }
  }

  function init(app: App) {
    setTimeout(function() {
      app.actions.openCurtains();
    }, 4000);

    app.el.neonSign.addEventListener('click', function() {
      app.actions.enterTheMagic();
    });
    app.el.splash.addEventListener('click', function() {
      app.actions.enterTheMagic();
    })
  }

  init(app);
}());    

