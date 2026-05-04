// perry/tui — native TUI engine for Perry (#358).
//
// v0.2 surface (Phase 2): adds reactive state, keypress input, and the
// interactive `run()` render loop on top of Phase 1's Box / Text /
// render. Flexbox layout via Taffy is Phase 3; the wider widget set
// (Spacer, Input, TextArea, List, Select, Spinner, ProgressBar)
// lands in Phase 4.

declare module "perry/tui" {
    /**
     * Opaque widget handle returned by Box / Text. Pass to render(),
     * or to Box() as a child.
     */
    export type Widget = number & { readonly __perryTuiWidget: unique symbol };

    /**
     * Reactive state container. `.get()` returns the current value;
     * `.set(v)` writes a new value and triggers a re-render of the
     * `run()` loop on the next tick.
     */
    export interface State<T> {
        get(): T;
        set(value: T): void;
    }

    /**
     * Single-line text node.
     */
    export function Text(content: string): Widget;

    /**
     * Style options for a Box. Maps to Taffy's flexbox solver — the
     * v0.3 surface (#358 Phase 3) supports flexDirection /
     * justifyContent / alignItems, integer-cell gap and uniform
     * padding, and explicit width / height. flex-grow / flex-shrink /
     * flex-basis / per-side padding land in Phase 3.5.
     */
    export interface BoxStyle {
        flexDirection?: "row" | "column";
        justifyContent?:
            | "start"
            | "center"
            | "end"
            | "flex-end"
            | "space-between"
            | "space-around";
        alignItems?: "start" | "center" | "end" | "flex-end" | "stretch";
        gap?: number;
        padding?: number;
        width?: number;
        height?: number;
        /** CSS flex-grow factor. 0 = no grow (default); 1 = fill remaining space. */
        flexGrow?: number;
    }

    /**
     * Container with optional flexbox style and children. Box defaults
     * to `flexDirection: "column"`, gap=0, padding=0 — matches the
     * v0.1 vertical-stack behavior so existing code keeps working
     * without supplying a style.
     */
    export function Box(): Widget;
    export function Box(children: Widget[]): Widget;
    export function Box(style: BoxStyle): Widget;
    export function Box(style: BoxStyle, children: Widget[]): Widget;

    /**
     * Paint one frame of `root` to stdout and return. Diffs against
     * the previous frame and emits only the cells that changed.
     * Use `run()` instead for interactive apps that re-render on
     * input or state change.
     */
    export function render(root: Widget): void;

    /**
     * Clear the screen and home the cursor. Called implicitly on
     * first render; exposed separately for callers that want explicit
     * setup before any render.
     */
    export function enter(): void;

    /**
     * Empty Box with `flexGrow: 1` — pushes siblings apart in a row
     * layout (and up/down in a column). Equivalent to
     * `Box({ flexGrow: 1 })` with a more discoverable name.
     */
    export function Spacer(): Widget;

    /**
     * `[====    ]`-style filled bar. `value`/`max` → fraction of
     * `width` cells filled with `=`; the rest are spaces. Brackets
     * are added at both ends so the widget's total width is
     * `width + 2`.
     */
    export function ProgressBar(value: number, max: number, width: number): Widget;

    /**
     * Animated character cycling through `-\|/` based on a frame
     * counter. Caller bumps the frame number from a state slot to
     * animate (`Spinner(frame.get())` inside the component, with a
     * `setInterval(() => frame.set(frame.get() + 1), 100)` driver).
     */
    export function Spinner(frame: number): Widget;

    /**
     * Single-line text input renderer. Shows `value` followed by a
     * `_` cursor character. Wire keypresses via `useInput` and
     * mutate the value state — the widget itself is purely visual.
     *
     * v1 limitation: cursor is always at the end. Cursor
     * repositioning lands in v1.5.
     */
    export function Input(value: string): Widget;

    /**
     * Vertical list of items as a Box of Text children. The
     * `selected` index (default -1 = no selection) is rendered with
     * reverse-video.
     */
    export function List(items: string[], selected?: number): Widget;

    /**
     * List with an enforced selection. Caller's state holds the
     * selected index.
     */
    export function Select(items: string[], selected: number): Widget;

    /**
     * Multi-line text renderer. Splits `value` on `\n` and emits
     * one Text per line inside a column-layout Box. Wire keypresses
     * via `useInput` to edit.
     */
    export function TextArea(value: string): Widget;

    /**
     * Allocate a reactive state slot with the given initial value.
     */
    export function state<T>(initial: T): State<T>;

    /**
     * Register a keypress handler. The handler is called with the raw
     * byte sequence as a string — single ASCII bytes for printable
     * keys, multi-byte ANSI sequences for arrow keys / function keys
     * (e.g. `"\x1b[A"` for Up). Only one handler is supported in v1;
     * subsequent calls replace the prior handler.
     */
    export function useInput(handler: (input: string) => void): void;

    /**
     * Enter the interactive render loop. `component()` is called on
     * every state change; the returned widget tree is diffed and
     * painted with no flicker. Call `exit()` from a useInput handler
     * to leave the loop.
     */
    export function run(component: () => Widget): void;

    /**
     * Exit the render loop. The current frame finishes; raw mode is
     * restored and the alt screen is left before `run()` returns.
     */
    export function exit(): void;
}
