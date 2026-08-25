import { pad2, weekdayLabel } from './util.js?v=20260825-x-popup-layout';

export function startClock() {
  const timeNode = document.getElementById('clock-time');
  const dateNode = document.getElementById('clock-date');

  const render = () => {
    const now = new Date();
    timeNode.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(
      now.getSeconds()
    )}`;
    dateNode.textContent = `${now.getFullYear()}年${
      now.getMonth() + 1
    }月${now.getDate()}日（${weekdayLabel(now)}）`;
  };

  render();
  setInterval(render, 1000);
}
