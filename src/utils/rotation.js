const rNbr = (number) => {
  return parseFloat(number.toFixed(2))
}

const rDeg = (number) => {
  const abs = Math.abs(Math.round(parseFloat(number) * 100000))
  for (let i = 1; i <= 10; i++) {
    if (abs === Math.round(parseFloat(Math.PI / i) * 100000))
      return `${number < 0 ? '-' : ''}Math.PI${i > 1 ? ' / ' + i : ''}`
  }
  for (let i = 1; i <= 10; i++) {
    if (abs === Math.round(parseFloat(Math.PI * i) * 100000))
      return `${number < 0 ? '-' : ''}Math.PI${i > 1 ? ' * ' + i : ''}`
  }
  return rNbr(number)
}

module.exports = { rNbr, rDeg }
