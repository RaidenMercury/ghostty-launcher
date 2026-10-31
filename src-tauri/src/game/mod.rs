//! Piezas del formato de versión de Minecraft.
//!
//! `version` resuelve la herencia (`inheritsFrom`) que usan los loaders, y `rules`
//! implementa la evaluación de reglas de librerías/argumentos. Sin esto, Forge y
//! NeoForge no se pueden lanzar aunque se instalen.

pub mod args;
pub mod rules;
pub mod version;
