// A compact set for the message box: no skin-tone or joined sequences, so they render everywhere.
const FACES = (
  '😀😃😄😁😆😅😂🙂😉😊😇🥰😍😘😋😛😜🤪😎🤓🥳🤩😏😒😞😔😟😕🙁😣😖😫😩🥺😢😭😤😠😡🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫😶😐😑😬🙄😯😮😲😴🤤😪😵🤐🤢🤮😷' +
  '👍👎👌✌️🤞🤟🤘👈👉👆👇👋🤚🖐️✋👏🙌🤝🙏💪👀🧠' +
  '❤️🧡💛💚💙💜🖤🤍💔💕💖💯💢💥💫✨🔥⭐🌟🎉🎊🎁🎈' +
  '☀️🌙🌈⚡❄️☔🌸🌹🍀🌍🐶🐱🐭🐻🦊🐼🐸🐵🦄🐝🦋🍕🍔🍟🌮🍣🍩🍪🍰🍺🍷☕⚽🏀🎮🎧🎵📷💻📱💡🔑🚀✈️🚗🏠⏰✅❌⚠️❓❗'
)

export const EMOJIS = [...new Intl.Segmenter().segment(FACES)].map((s) => s.segment)
