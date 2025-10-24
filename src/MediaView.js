// Универсальный слой рендера: фото+caption+кнопки или текст,
// с редактированием "по месту" и мягким удалением когда нужно.
export class MediaView {
    constructor({ sendWithInline, edit, sendPhoto, editPhotoMedia, deleteMsg, assets }) {
      this.sendWithInline = sendWithInline;
      this.edit = edit;
      this.sendPhoto = sendPhoto;
      this.editPhotoMedia = editPhotoMedia;
      this.deleteMsg = deleteMsg;
      this.assets = assets || {};
    }
  
    // Достаём file_id из CONFIG.ASSETS для ключа place.
    // Поддерживаем оба формата: SQUARE и SQUARE_BANNER_FILE_ID, etc.
    _resolveFileId(place) {
      if (!place || !this.assets) return null;
      const key1 = place;                         // e.g. "Square"
      const key2 = place.toUpperCase();           // "SQUARE"
      const key3 = `${key2}_BANNER_FILE_ID`;      // "SQUARE_BANNER_FILE_ID"
      // частные кейсы для обратной совместимости
      const aliases = {
        Square: ["SQUARE", "SQUARE_BANNER_FILE_ID"],
        Upgrades: ["UPGRADES", "UPGRADES_BANNER_FILE_ID"],
        Work: ["WORK", "WORK_BANNER_FILE_ID"],
        Study: ["STUDY", "STUDY_BANNER_FILE_ID"],
        Home: ["HOME", "HOME_BANNER_FILE_ID"],
        Shop: ["SHOP", "SHOP_BANNER_FILE_ID"],
        Casino: ["CASINO", "CASINO_BANNER_FILE_ID"],
        Gym: ["GYM", "GYM_BANNER_FILE_ID"],
      };
  
      // 1) прямой ключ
      if (this.assets[key1]) return this.assets[key1];
      if (this.assets[key2]) return this.assets[key2];
      if (this.assets[key3]) return this.assets[key3];
  
      // 2) алиасы
      const arr = aliases[place] || [];
      for (const k of arr) if (this.assets[k]) return this.assets[k];
  
      return null;
    }
  
    _isPhotoMsg(msg) {
      return Boolean(msg && Array.isArray(msg.photo) && msg.photo.length > 0);
    }
  
    // policy:
    //  - "photo": стараться показать фото (если нет file_id или методов — будет мягкий фоллбек в текст)
    //  - "text": принудительно текст
    //  - "auto": фото если есть file_id, иначе текст
    async show({ sourceMsg = null, place, caption, keyboard, policy = "auto", asset = null }) {
      const resolved = this._resolveFileId(place);
      const fileId = asset || resolved;                     // ← приоритет у переданного asset
      const canPhoto = Boolean(this.sendPhoto && this.editPhotoMedia);
  
      let wantPhoto = false;
      if (policy === "photo") wantPhoto = true;
      else if (policy === "text") wantPhoto = false;
      if (policy === "auto") wantPhoto = Boolean(fileId);  // учитываем override
  
      // если хотим фото, но нет fileId или медиахелперов — фоллбек в текст
      if (wantPhoto && (!fileId || !canPhoto)) wantPhoto = false;
  
      if (!sourceMsg) {
        // Нет исходного сообщения (например, пришли текстовой кнопкой) — просто шлём новое
        if (wantPhoto) {
          await this.sendPhoto(fileId, caption, keyboard);
        } else {
          await this.sendWithInline(caption, keyboard);
        }
        return;
      }
  
      // Есть исходное сообщение — пытаемся редактировать по месту
      const wasPhoto = this._isPhotoMsg(sourceMsg);
  
      try {
        if (wasPhoto && wantPhoto) {
          // фото -> фото: идеальный случай
          await this.editPhotoMedia(sourceMsg, fileId, caption, keyboard);
          return;
        }
        if (!wasPhoto && !wantPhoto) {
          // текст -> текст
          await this.edit(sourceMsg, caption, keyboard);
          return;
        }
  
        // Невозможные переходы: фото <-> текст
        if (this.deleteMsg) {
          await this.deleteMsg(sourceMsg).catch(() => {});
          if (wantPhoto) {
            await this.sendPhoto(fileId, caption, keyboard);
          } else {
            await this.sendWithInline(caption, keyboard);
          }
          return;
        }
  
        // если deleteMsg не прокинули — мягкий фоллбек
        await this.edit(sourceMsg, caption, keyboard);
      } catch {
        // На любой ошибке — просто пошлём новое сообщение нужного типа
        if (wantPhoto) await this.sendPhoto(fileId, caption, keyboard);
        else await this.sendWithInline(caption, keyboard);
      }
    }
  }
  