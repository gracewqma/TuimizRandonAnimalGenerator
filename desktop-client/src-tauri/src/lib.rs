use std::fs;
use std::path::PathBuf;
use rand::Rng;
use serde_json::Value;
use tauri::Manager;

/// Resuelve el path a la carpeta parts/.
/// En desarrollo: relativo a CARGO_MANIFEST_DIR/../parts
/// En produccion: usa el resource_dir de Tauri
fn get_parts_dir(app_handle: &tauri::AppHandle) -> PathBuf {
    // Development path: src-tauri/../parts
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("parts");
    if dev_path.exists() {
        return dev_path;
    }
    // Production path: bundled resource
    app_handle
        .path()
        .resource_dir()
        .unwrap_or_default()
        .join("parts")
}

fn get_pool_path(app_handle: &tauri::AppHandle, category: &str) -> Result<PathBuf, String> {
    let dir = get_parts_dir(app_handle);
    let path = dir.join(format!("{}.json", category));
    if !path.exists() {
        return Err(format!("Pool '{}' not found at {:?}", category, path));
    }
    Ok(path)
}

fn read_pool(app_handle: &tauri::AppHandle, category: &str) -> Result<Vec<String>, String> {
    let path = get_pool_path(app_handle, category)?;
    let data = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read {}: {}", category, e))?;
    let items: Vec<String> = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse {}: {}", category, e))?;
    Ok(items)
}

fn write_pool(app_handle: &tauri::AppHandle, category: &str, items: &[String]) -> Result<(), String> {
    let path = get_pool_path(app_handle, category)?;
    let data = serde_json::to_string_pretty(items)
        .map_err(|e| format!("Failed to serialize {}: {}", category, e))?;
    fs::write(&path, data)
        .map_err(|e| format!("Failed to write {}: {}", category, e))?;
    Ok(())
}

/// Devuelve el contenido completo de un pool (sin modificar).
#[tauri::command]
fn get_pool(app_handle: tauri::AppHandle, category: String) -> Result<Vec<String>, String> {
    read_pool(&app_handle, &category)
}

/// Elige un item aleatorio del pool, lo elimina del JSON y lo devuelve.
#[tauri::command]
fn pick_and_remove(app_handle: tauri::AppHandle, category: String) -> Result<String, String> {
    let mut items = read_pool(&app_handle, &category)?;
    if items.is_empty() {
        return Err(format!("Pool '{}' is empty! Hit Reset to restore.", category));
    }

    let idx = rand::thread_rng().gen_range(0..items.len());
    let selected = items.remove(idx);

    write_pool(&app_handle, &category, &items)?;

    Ok(selected)
}

/// Elige un item aleatorio de extras SIN eliminarlo del pool.
#[tauri::command]
fn pick_extra(app_handle: tauri::AppHandle) -> Result<String, String> {
    let items = read_pool(&app_handle, "extras")?;
    if items.is_empty() {
        return Err("Extras pool is empty!".to_string());
    }

    let idx = rand::thread_rng().gen_range(0..items.len());
    Ok(items[idx].clone())
}

/// Restaura todos los pools (excepto extras) desde seeder.json.
#[tauri::command]
fn reset_pools(app_handle: tauri::AppHandle) -> Result<(), String> {
    let dir = get_parts_dir(&app_handle);
    let seeder_path = dir.join("seeder.json");

    let data = fs::read_to_string(&seeder_path)
        .map_err(|e| format!("Failed to read seeder.json: {}", e))?;
    let seeder: Value = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse seeder.json: {}", e))?;

    let categories = [
        "base", "head", "ears", "eyes", "nose",
        "legs", "feet", "tail", "coat", "colour",
    ];

    for cat in &categories {
        if let Some(items) = seeder.get(*cat) {
            let pool_path = dir.join(format!("{}.json", cat));
            let json = serde_json::to_string_pretty(items)
                .map_err(|e| format!("Failed to serialize {}: {}", cat, e))?;
            fs::write(&pool_path, json)
                .map_err(|e| format!("Failed to write {}: {}", cat, e))?;
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_pool,
            pick_and_remove,
            pick_extra,
            reset_pools,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
