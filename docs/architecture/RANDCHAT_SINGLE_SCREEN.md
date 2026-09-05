# RandChat single-screen viewport contract

RandChat on phone/tablet must not make the RandApp document scroll vertically.

The visible workspace is measured at runtime from the top edge of `rc-module` to the top edge of the fixed bottom navigation (or to the visual viewport bottom when the bottom navigation is hidden). This avoids hard-coded offsets that break with iPhone safe areas, Dynamic Island, UI-size scaling, orientation changes and the software keyboard.

While RandChat is mounted:

- document scrolling is disabled;
- `rs-content` drops its normal bottom navigation clearance;
- tabs, conversation header, composer and RandApp bottom navigation stay on-screen;
- only thread/group lists and the message history may scroll internally;
- `visualViewport` resize/scroll events recompute the available height for keyboard/orientation changes;
- leaving RandChat restores normal RandApp page scrolling.
