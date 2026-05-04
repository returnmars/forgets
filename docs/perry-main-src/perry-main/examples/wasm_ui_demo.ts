// Perry WASM UI Demo — showcases all major UI elements
// Compile: perry examples/wasm_ui_demo.ts --target wasm -o wasm_ui_demo.html

import {
  App, VStack, HStack, Text, Button, TextField, Toggle, Slider,
  ScrollView, Spacer, Divider, Canvas, Form, Section, ProgressView,
} from 'perry/ui';
import { State } from 'perry/ui';

// ─── State ───
const count = State.create(0);
const sliderVal = State.create(50);
const darkMode = State.create(0);
const userName = State.create("");

// ─── Header ───
const title = Text("Perry WASM UI Demo");
title.setFontSize(24);
title.setFontWeight(700);

const subtitle = Text("All UI elements running in WebAssembly");
subtitle.setFontSize(13);
subtitle.setForeground(0.5, 0.5, 0.5, 1);

const header = VStack(4);
header.addChild(title);
header.addChild(subtitle);
header.setPadding(16);

// ─── Counter Section ───
const countLabel = Text("Count: 0");
countLabel.setFontSize(18);
count.bindText(countLabel);

const incBtn = Button("  +  ", () => {
  count.set(count.get() + 1);
});
incBtn.setBackground(0.2, 0.5, 1.0, 1);
incBtn.setForeground(1, 1, 1, 1);
incBtn.setCornerRadius(8);

const decBtn = Button("  −  ", () => {
  const c = count.get() as number;
  if (c > 0) count.set(c - 1);
});
decBtn.setCornerRadius(8);

const resetBtn = Button("Reset", () => {
  count.set(0);
});

const counterRow = HStack(8);
counterRow.addChild(decBtn);
counterRow.addChild(countLabel);
counterRow.addChild(incBtn);
counterRow.addChild(Spacer());
counterRow.addChild(resetBtn);

// ─── Slider Section ───
const sliderLabel = Text("Slider: 50");
sliderVal.bindText(sliderLabel);

const slider = Slider(0, 100, 50, (val: number) => {
  sliderVal.set(Math.round(val));
});

const progress = ProgressView(0.5);
sliderVal.onChange((val: number) => {
  // Update progress based on slider
});

// ─── Input Section ───
const nameField = TextField("Enter your name...", (val: string) => {
  userName.set(val);
});

const greetingLabel = Text("Hello!");
greetingLabel.setFontSize(14);
userName.onChange((val: string) => {
  if (val && (val as any) !== 0) {
    greetingLabel.setForeground(0.1, 0.6, 0.3, 1);
  }
});
userName.bindText(greetingLabel);

// ─── Toggle Section ───
const darkToggle = Toggle("Dark mode", (val: number) => {
  darkMode.set(val);
});

const modeLabel = Text("Light mode");
darkMode.onChange((val: number) => {
  if (val) {
    modeLabel.setForeground(0.8, 0.8, 0.2, 1);
  } else {
    modeLabel.setForeground(0.2, 0.2, 0.2, 1);
  }
});
darkMode.bindText(modeLabel);

const toggleRow = HStack(12);
toggleRow.addChild(darkToggle);
toggleRow.addChild(modeLabel);

// ─── Canvas Section ───
const canvas = Canvas(280, 120);
// Draw a gradient background
canvas.setFillColor(0.95, 0.95, 1.0, 1);
canvas.fillRect(0, 0, 280, 120);

// Draw some shapes
canvas.setFillColor(0.2, 0.5, 1.0, 0.8);
canvas.fillRect(10, 10, 60, 60);

canvas.setFillColor(1.0, 0.4, 0.3, 0.8);
canvas.fillRect(80, 20, 50, 50);

canvas.setFillColor(0.3, 0.8, 0.4, 0.8);
canvas.beginPath();
canvas.arc(190, 40, 30, 0, 6.28);
canvas.fill();

// Draw text
canvas.setFillColor(0.2, 0.2, 0.2, 1);
canvas.setFont("14px sans-serif");
canvas.fillText("Canvas drawing!", 10, 100);

// Draw lines
canvas.setStrokeColor(0.6, 0.3, 0.8, 1);
canvas.setLineWidth(2);
canvas.beginPath();
canvas.moveTo(230, 10);
canvas.lineTo(270, 50);
canvas.lineTo(230, 90);
canvas.lineTo(270, 110);
canvas.stroke();

// ─── Form Section ───
const formSection = Section("Settings");

const nameRow = HStack(8);
const nameLabel = Text("Name:");
nameLabel.setFontWeight(600);
nameRow.addChild(nameLabel);
nameRow.addChild(nameField);

const sliderRow = HStack(8);
const sLabel = Text("Value:");
sLabel.setFontWeight(600);
sliderRow.addChild(sLabel);
sliderRow.addChild(slider);
sliderRow.addChild(sliderLabel);

formSection.addChild(nameRow);
formSection.addChild(sliderRow);
formSection.addChild(toggleRow);

// ─── Info Cards ───
const card1 = VStack(4);
card1.setBackground(0.96, 0.97, 1.0, 1);
card1.setCornerRadius(10);
card1.setPadding(12);
const c1t = Text("Widgets");
c1t.setFontWeight(700);
const c1b = Text("20+ UI components");
c1b.setFontSize(13);
c1b.setForeground(0.4, 0.4, 0.4, 1);
card1.addChild(c1t);
card1.addChild(c1b);

const card2 = VStack(4);
card2.setBackground(0.96, 0.97, 1.0, 1);
card2.setCornerRadius(10);
card2.setPadding(12);
const c2t = Text("State");
c2t.setFontWeight(700);
const c2b = Text("Reactive bindings");
c2b.setFontSize(13);
c2b.setForeground(0.4, 0.4, 0.4, 1);
card2.addChild(c2t);
card2.addChild(c2b);

const card3 = VStack(4);
card3.setBackground(0.96, 0.97, 1.0, 1);
card3.setCornerRadius(10);
card3.setPadding(12);
const c3t = Text("Canvas");
c3t.setFontWeight(700);
const c3b = Text("2D drawing API");
c3b.setFontSize(13);
c3b.setForeground(0.4, 0.4, 0.4, 1);
card3.addChild(c3t);
card3.addChild(c3b);

const cardsRow = HStack(8);
cardsRow.addChild(card1);
cardsRow.addChild(card2);
cardsRow.addChild(card3);

// ─── Assemble Layout ───
const content = VStack(12);
content.setPadding(16);
content.addChild(counterRow);
content.addChild(Divider());
content.addChild(greetingLabel);
content.addChild(formSection);
content.addChild(Divider());
content.addChild(cardsRow);
content.addChild(Divider());
content.addChild(canvas);
content.addChild(progress);

const scroll = ScrollView();
scroll.addChild(content);

const root = VStack(0);
root.addChild(header);
root.addChild(Divider());
root.addChild(scroll);

App({ title: "Perry WASM UI Demo", width: 480, height: 640, body: root });

console.log("Demo loaded successfully!");
