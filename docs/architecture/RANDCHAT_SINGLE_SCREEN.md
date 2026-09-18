# RandChat single-screen viewport contract

RandChat on phone/tablet lives inside the canonical RandUI content viewport.

## Current contract

The RandApp shell owns the device viewport. RandChat **does not** measure `window.innerHeight`, `visualViewport`, header height or bottom-nav geometry.

While RandChat is mounted:

- document-level scrolling remains disabled by the RandUI shell;
- `.rs-content` is the RandUI scroll/workspace owner;
- RandChat fills `.rs-content` at 100% height;
- tabs stay above the messenger workspace;
- conversation header and composer stay inside the workspace and do not scroll away;
- only the conversation list and message history scroll internally;
- groups and encrypted DMs use the same shared thread-scroll engine;
- opening a thread anchors to the latest message;
- outgoing messages follow the bottom;
- incoming messages auto-follow only when the user is already near the bottom;
- when the user is reading older history, position is preserved and a “jump to latest” control is shown.

## Why

The previous RandChat implementation independently measured the browser viewport and bottom navigation. That became incorrect after RandUI changed the mobile/tablet shell so only the central content area owns scrolling.

The current model removes competing geometry and matches the mature chat behavior used as reference from Telegram X without copying Telegram X source code.

## Ownership

- `src/randapp/chat/ChatGroups.jsx` — messenger mode switch and RandUI workspace binding.
- `src/randapp/chat/useChatThreadScroll.js` — shared thread position / auto-follow behavior.
- `src/randapp/chat/chat-viewport.css` — workspace geometry.
- `src/randapp/chat/chat.css` — canonical RandChat v2 visual layout.
