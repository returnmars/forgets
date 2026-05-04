use objc2::rc::Retained;
use objc2_app_kit::{NSBox, NSBoxType, NSView};
use objc2_foundation::MainThreadMarker;

/// Create a horizontal separator line (NSBox with separator type).
pub fn create() -> i64 {
    let mtm = MainThreadMarker::new().expect("perry/ui must run on the main thread");

    unsafe {
        let separator = NSBox::new(mtm);
        separator.setBoxType(NSBoxType::Separator);
        let view: Retained<NSView> = Retained::cast_unchecked(separator);
        super::register_widget(view)
    }
}
