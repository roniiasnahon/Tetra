import React, { useState } from "react";
import { Icon } from "./SolarIcon";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { Tab } from "../App";
import { Notes, FolderWithFiles, PenNewRound, MinimalisticMagnifier, AddFolder, UploadMinimalistic } from "@solar-icons/react";

interface FolderItem {
  id: string;
  name: string;
  createdAt: number;
}

interface PaperItem {
  author: string;
  title: string;
  description: string;
  url?: string;
  added?: string;
  fullTextStatus?: string;
  viewed?: string;
  fileType?: string;
  summary?: string;
  fileId?: string;
  mimetype?: string;
  folderId?: string;
  notes?: string;
}

interface LibraryPanelProps {
  papers: PaperItem[];
  folders: FolderItem[];
  selectedFolderId: string | null;
  setSelectedFolderId: (id: string | null) => void;
  dbSetPaper: (paper: PaperItem) => void;
  dbSetFolder: (folder: FolderItem) => void;
  dbDeleteFolder: (id: string) => void;
  dbDeletePaper: (title: string) => void;
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTabId: (id: string) => void;
  createNewDocument: (targetFolderId?: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Drag and drop handlers passed from App.tsx
  handleLibraryDragStart: (
    e: React.DragEvent,
    type: "paper" | "folder",
    id: string,
    title?: string
  ) => void;
  handleLibraryDragOverFolder: (e: React.DragEvent, folderId: string) => void;
  handleFolderDragLeave: () => void;
  handleLibraryDropOnFolder: (
    e: React.DragEvent,
    targetFolderId: string
  ) => void;
  handleLibraryDragOverRoot: (e: React.DragEvent) => void;
  handleLibraryDropOnRoot: (e: React.DragEvent) => void;

  dragOverFolderId: string | null;
  dragOverRootLibrary: boolean;
  setDragOverRootLibrary: (val: boolean) => void;

  handlePaperClick: (paper: PaperItem) => void;
  formatAbstractText: (text: string) => string;
  appLanguage?: string;
}

const LIBRARY_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    library: "Library",
    desc: "Files, research assets, and citation repository",
    search: "Search collection...",
    display: "Display",
    density: "Density",
    comfortable: "Comfortable",
    compact: "Compact",
    sort: "Sort",
    title: "Title",
    added: "Added",
    viewed: "Viewed",
    type: "Type",
    filter: "Filter",
    all: "All Files",
    documents: "Documents",
    folders: "Folders",
    name: "Name",
    items: "items",
    item: "item",
    authors: "Authors",
    folder: "Folder",
    summary: "Summary",
    add: "Add",
    newFolder: "New folder",
    addDoc: "New document",
    fileUpload: "File upload",
    researchFolders: "Research Folders",
    folderName: "Folder Name",
    size: "Size",
    created: "Created",
    actions: "Actions",
    allFolders: "All Folders",
    browsingDir: "Browsing Directory",
    folderEmpty: "Folder is Empty",
    folderEmptyDesc: "No assets have been added here yet. Create some research notes or export Summaries to fill it!",
    uploadPdf: "Upload PDF File",
    dateAdded: "Date Added",
    lastViewed: "Last Viewed",
    ascending: "Ascending",
    descending: "Descending",
    filesInLibrary: "{num} files in library",
    notes: "Notes",
    learnFileTypes: "Learn about File Types"
  },
  fr: {
    library: "Bibliothèque",
    desc: "Répertoire de fichiers, ressources de recherche et citations",
    search: "Rechercher dans la collection...",
    display: "Affichage",
    density: "Densité",
    comfortable: "Confortable",
    compact: "Compact",
    sort: "Trier",
    title: "Titre",
    added: "Ajouté",
    viewed: "Vu",
    type: "Type",
    filter: "Filtrer",
    all: "Tous les fichiers",
    documents: "Documents",
    folders: "Dossiers",
    name: "Nom",
    items: "éléments",
    item: "élément",
    authors: "Auteurs",
    folder: "Dossier",
    summary: "Résumé",
    add: "Ajouter",
    newFolder: "Nouveau dossier",
    addDoc: "Nouveau document",
    fileUpload: "Téléchargement",
    researchFolders: "Dossiers de recherche",
    folderName: "Nom du dossier",
    size: "Taille",
    created: "Créé le",
    actions: "Actions",
    allFolders: "Tous les dossiers",
    browsingDir: "Navigation dans le répertoire",
    folderEmpty: "Le dossier est vide",
    folderEmptyDesc: "Aucune ressource n'a encore été ajoutée ici. Créez des notes de recherche ou exportez des résumés pour le remplir !",
    uploadPdf: "Télécharger un fichier PDF",
    dateAdded: "Date d'ajout",
    lastViewed: "Dernière consultation",
    ascending: "Croissant",
    descending: "Décroissant",
    filesInLibrary: "{num} fichiers dans la bibliothèque",
    notes: "Notes",
    learnFileTypes: "En savoir plus sur les types de fichiers"
  },
  es: {
    library: "Biblioteca",
    desc: "Archivo de documentos, activos de investigación y citas",
    search: "Buscar en la colección...",
    display: "Mostrar",
    density: "Densidad",
    comfortable: "Cómodo",
    compact: "Compacto",
    sort: "Ordenar",
    title: "Título",
    added: "Añadido",
    viewed: "Visto",
    type: "Tipo",
    filter: "Filtrar",
    all: "Todos los archivos",
    documents: "Documentos",
    folders: "Carpetas",
    name: "Nombre",
    items: "elementos",
    item: "elemento",
    authors: "Autores",
    folder: "Carpeta",
    summary: "Resumen",
    add: "Añadir",
    newFolder: "Nueva carpeta",
    addDoc: "Nuevo documento",
    fileUpload: "Subir archivo",
    researchFolders: "Carpetas de investigación",
    folderName: "Nombre de carpeta",
    size: "Tamaño",
    created: "Creado",
    actions: "Acciones",
    allFolders: "Todas las carpetas",
    browsingDir: "Dirección de exploración",
    folderEmpty: "La carpeta está vacía",
    folderEmptyDesc: "Aún no se han añadido activos aquí. ¡Cree notas de investigación o exporte resúmenes para llenarla!",
    uploadPdf: "Subir archivo PDF",
    dateAdded: "Fecha añadida",
    lastViewed: "Última vista",
    ascending: "Ascendente",
    descending: "Descendente",
    filesInLibrary: "{num} archivos en la biblioteca",
    notes: "Notas",
    learnFileTypes: "Aprenda sobre los tipos de archivos"
  },
  de: {
    library: "Bibliothek",
    desc: "Verzeichnis für Dateien, Forschungsressourcen und Zitate",
    search: "Sammlung durchsuchen...",
    display: "Anzeige",
    density: "Dichte",
    comfortable: "Komfortabel",
    compact: "Kompakt",
    sort: "Sortieren",
    title: "Titel",
    added: "Hinzugefügt",
    viewed: "Angesehen",
    type: "Typ",
    filter: "Filtern",
    all: "Alle Dateien",
    documents: "Dokumente",
    folders: "Ordner",
    name: "Name",
    items: "Elemente",
    item: "Element",
    authors: "Autoren",
    folder: "Ordner",
    summary: "Zusammenfassung",
    add: "Hinzufügen",
    newFolder: "Neuer Ordner",
    addDoc: "Neues Dokument",
    fileUpload: "Datei hochladen",
    researchFolders: "Forschungsordner",
    folderName: "Ordnername",
    size: "Größe",
    created: "Erstellt",
    actions: "Aktionen",
    allFolders: "Alle Ordner",
    browsingDir: "Verzeichnis durchsuchen",
    folderEmpty: "Ordner ist leer",
    folderEmptyDesc: "Hier wurden noch keine Ressourcen hinzugefügt. Erstellen Sie Forschungsnotizen oder exportieren Sie Zusammenfassungen, um ihn zu füllen!",
    uploadPdf: "PDF-Datei hochladen",
    dateAdded: "Hinzufüge-Datum",
    lastViewed: "Zuletzt angesehen",
    ascending: "Aufsteigend",
    descending: "Absteigend",
    filesInLibrary: "{num} Dateien in der Bibliothek",
    notes: "Notizen",
    learnFileTypes: "Erfahren Sie mehr über Dateitypen"
  },
  it: {
    library: "Biblioteca",
    desc: "Archivio di file, risorse di ricerca e citazioni",
    search: "Cerca nella raccolta...",
    display: "Visualizza",
    density: "Densità",
    comfortable: "Comodo",
    compact: "Compatto",
    sort: "Ordina",
    title: "Titolo",
    added: "Aggiunto",
    viewed: "Visualizzato",
    type: "Tipo",
    filter: "Filtra",
    all: "Tutti i file",
    documents: "Documenti",
    folders: "Cartelle",
    name: "Nome",
    items: "elementi",
    item: "elemento",
    authors: "Autori",
    folder: "Cartella",
    summary: "Sommario",
    add: "Aggiungi",
    newFolder: "Nuova cartella",
    addDoc: "Nuovo documento",
    fileUpload: "Carica file",
    researchFolders: "Cartelle di ricerca",
    folderName: "Nome cartella",
    size: "Dimensioni",
    created: "Creato",
    actions: "Azioni",
    allFolders: "Tutte le cartelle",
    browsingDir: "Sfoglia directory",
    folderEmpty: "La cartella è vuota",
    folderEmptyDesc: "Nessuna risorsa è stata ancora aggiunta qui. Crea note di ricerca o esporta riassunti per riempirla!",
    uploadPdf: "Carica file PDF",
    dateAdded: "Data aggiunta",
    lastViewed: "Ultima consultazione",
    ascending: "Crescente",
    descending: "Decrescente",
    filesInLibrary: "{num} file nella biblioteca",
    notes: "Note",
    learnFileTypes: "Scopri i tipi di file"
  },
  pt: {
    library: "Biblioteca",
    desc: "Arquivo de arquivos, recursos de pesquisa e citações",
    search: "Buscar na coleção...",
    display: "Visualização",
    density: "Densidade",
    comfortable: "Confortável",
    compact: "Compacto",
    sort: "Ordenar",
    title: "Título",
    added: "Adicionado",
    viewed: "Visualizado",
    type: "Tipo",
    filter: "Filtrar",
    all: "Todos os arquivos",
    documents: "Documentos",
    folders: "Pastas",
    name: "Nome",
    items: "itens",
    item: "item",
    authors: "Autores",
    folder: "Pasta",
    summary: "Resumo",
    add: "Adicionar",
    newFolder: "Nova pasta",
    addDoc: "Novo documento",
    fileUpload: "Enviar arquivo",
    researchFolders: "Pastas de pesquisa",
    folderName: "Nome da pasta",
    size: "Tamanho",
    created: "Criado",
    actions: "Ações",
    allFolders: "Todas as pastas",
    browsingDir: "Navegação no diretório",
    folderEmpty: "A pasta está vazia",
    folderEmptyDesc: "Nenhum recurso foi adicionado aqui ainda. Crie notas de pesquisa ou exporte resumos para preenchê-la!",
    uploadPdf: "Enviar arquivo PDF",
    dateAdded: "Data de adição",
    lastViewed: "Última visualização",
    ascending: "Crescente",
    descending: "Decrescente",
    filesInLibrary: "{num} arquivos na biblioteca",
    notes: "Notas",
    learnFileTypes: "Saiba mais sobre tipos de arquivo"
  },
  ar: {
    library: "المكتبة",
    desc: "مستودع الملفات وأصول الأبحاث والمراجع",
    search: "البحث في المجموعة...",
    display: "العرض",
    density: "الكثافة",
    comfortable: "مريح",
    compact: "مدمج",
    sort: "فرز",
    title: "العنوان",
    added: "تم الإضافة",
    viewed: "تم العرض",
    type: "النوع",
    filter: "تصفية",
    all: "جميع الملفات",
    documents: "المستندات",
    folders: "المجلدات",
    name: "الاسم",
    items: "عناصر",
    item: "عنصر",
    authors: "المؤلفون",
    folder: "المجلد",
    summary: "الملخص",
    add: "إضافة",
    newFolder: "مجلد جديد",
    addDoc: "مستند جديد",
    fileUpload: "تحميل ملف",
    researchFolders: "مجلدات الأبحاث",
    folderName: "اسم المجلد",
    size: "الحجم",
    created: "تاريخ الإنشاء",
    actions: "الإجراءات",
    allFolders: "جميع المجلدات",
    browsingDir: "تصفح الدليل",
    folderEmpty: "المجلد فارغ",
    folderEmptyDesc: "لم يتم إضافة أي أصول هنا بعد. قم بإنشاء بعض الملاحظات البحثية أو قم بتصدير الملخصات لملئه!",
    uploadPdf: "تحميل ملف pdf",
    dateAdded: "تاريخ الإضافة",
    lastViewed: "آخر مشاهدة",
    ascending: "تصاعدي",
    descending: "تنازلي",
    filesInLibrary: "{num} ملفات في المكتبة",
    notes: "الملاحظات",
    learnFileTypes: "تعرف على أنواع الملفات"
  },
  zh: {
    library: "文献库",
    desc: "文件、研究资产和文献引用项",
    search: "搜索集合...",
    display: "显示",
    density: "密度",
    comfortable: "舒适",
    compact: "紧凑",
    sort: "排序",
    title: "标题",
    added: "已添加",
    viewed: "已查看",
    type: "类型",
    filter: "筛选",
    all: "所有文件",
    documents: "文档",
    folders: "文件夹",
    name: "名称",
    items: "项",
    item: "项",
    authors: "作者",
    folder: "文件夹",
    summary: "摘要",
    add: "添加",
    newFolder: "新建文件夹",
    addDoc: "新建文档",
    fileUpload: "文件上传",
    researchFolders: "研究文件夹",
    folderName: "文件夹名称",
    size: "大小",
    created: "创建于",
    actions: "操作",
    allFolders: "所有文件夹",
    browsingDir: "浏览目录",
    folderEmpty: "文件夹为空",
    folderEmptyDesc: "此处尚未添加任何资产。创建一些研究笔记或导出摘要以填充它！",
    uploadPdf: "上传 PDF 文件",
    dateAdded: "添加日期",
    lastViewed: "上次查看",
    ascending: "升序",
    descending: "降序",
    filesInLibrary: "文献库中共有 {num} 个文件",
    notes: "笔记",
    learnFileTypes: "了解文件类型"
  },
  ja: {
    library: "ライブラリ",
    desc: "ファイル、研究用アセット、引用リポジトリ",
    search: "コレクションを検索...",
    display: "表示",
    density: "表示密度",
    comfortable: "標準",
    compact: "コンパクト",
    sort: "並べ替え",
    title: "タイトル",
    added: "追加日",
    viewed: "閲覧日",
    type: "種類",
    filter: "フィルター",
    all: "すべてのファイル",
    documents: "ドキュメント",
    folders: "フォルダ",
    name: "名前",
    items: "個のアイテム",
    item: "個のアイテム",
    authors: "著者",
    folder: "フォルダ",
    summary: "要約",
    add: "追加",
    newFolder: "新規フォルダ",
    addDoc: "ドキュメントを追加",
    fileUpload: "ファイルアップロード",
    researchFolders: "研究用フォルダ",
    folderName: "フォルダ名",
    size: "サイズ",
    created: "作成日",
    actions: "アクション",
    allFolders: "すべてのフォルダ",
    browsingDir: "ディレクトリの閲覧",
    folderEmpty: "フォルダは空です",
    folderEmptyDesc: "ここにはまだアセットが追加されていません。研究用メモを作成するか、要約を書き出してフォルダを満たしてください！",
    uploadPdf: "PDFファイルをアップロード",
    dateAdded: "追加日時",
    lastViewed: "最終閲覧",
    ascending: "昇順",
    descending: "降順",
    filesInLibrary: "ライブラリに {num} 個のファイル",
    notes: "メモ",
    learnFileTypes: "ファイル形式について"
  },
  hi: {
    library: "पुस्तकालय",
    desc: "फाइलें, अनुसंधान संपत्तियां और उद्धरण भंडार",
    search: "संग्रह खोजें...",
    display: "प्रदर्शन",
    density: "घनत्व",
    comfortable: "आरामदायक",
    compact: "सघन",
    sort: "छाँटें",
    title: "शीर्षक",
    added: "जोड़ा गया",
    viewed: "देखा गया",
    type: "प्रकार",
    filter: "फ़िल्टर",
    all: "सभी फ़ाइलें",
    documents: "दस्तावेज़",
    folders: "फ़ोल्डर",
    name: "नाम",
    items: "आइटम",
    item: "आइटम",
    authors: "लेखक",
    folder: "फ़ोल्डर",
    summary: "सारांश",
    add: "जोड़ें",
    newFolder: "नया फ़ोल्डर",
    addDoc: "नया दस्तावेज़",
    fileUpload: "फ़ाइल अपलोड",
    researchFolders: "अनुसंधान फ़ोल्डर",
    folderName: "फ़ोल्डर का नाम",
    size: "आकार",
    created: "बनाया गया",
    actions: "कार्रवाई",
    allFolders: "सभी फ़ोल्डर",
    browsingDir: "निर्देशिका ब्राउज़ करें",
    folderEmpty: "फ़ोल्डर खाली है",
    folderEmptyDesc: "यहाँ अभी तक कोई भी संपत्तियां नहीं जोड़ी गई हैं। इसे भरने के लिए कुछ शोध नोट्स बनाएं या सारांश निर्यात करें!",
    uploadPdf: "पीडीएफ फाइल अपलोड करें",
    dateAdded: "जोड़ा गया दिनांक",
    lastViewed: "अंतिम बार देखा गया",
    ascending: "आरोही",
    descending: "अवरोही",
    filesInLibrary: "पुस्तकालय में {num} फाइलें",
    notes: "नोट्स",
    learnFileTypes: "फ़ाइल प्रकारों के बारे में जानें"
  }
};

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  papers,
  folders,
  selectedFolderId,
  setSelectedFolderId,
  dbSetPaper,
  dbSetFolder,
  dbDeleteFolder,
  dbDeletePaper,
  tabs,
  setTabs,
  setActiveTabId,
  createNewDocument,
  fileInputRef,

  handleLibraryDragStart,
  handleLibraryDragOverFolder,
  handleFolderDragLeave,
  handleLibraryDropOnFolder,
  handleLibraryDragOverRoot,
  handleLibraryDropOnRoot,

  dragOverFolderId,
  dragOverRootLibrary,
  setDragOverRootLibrary,

  handlePaperClick,
  formatAbstractText,
  appLanguage,
}) => {
  const currentLang = appLanguage || "en";
  const lt = (key: string, defaultText: string) => {
    return LIBRARY_TRANSLATIONS[currentLang]?.[key] || LIBRARY_TRANSLATIONS["en"][key] || defaultText;
  };

  // Library toolbar and interaction states
  const [selectedPapers, setSelectedPapers] = useState<string[]>([]);
  const [displayDensity, setDisplayDensity] = useState<"comfortable" | "compact">(
    "comfortable"
  );
  const [sortBy, setSortBy] = useState<"title" | "added" | "viewed">("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");

  // Dropdown States
  const [isDisplayDropdownOpen, setIsDisplayDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [, setAddDropdownNested] = useState<string | null>(null);
  const [activeMoveFolderDropdown, setActiveMoveFolderDropdown] = useState<
    string | null
  >(null);

  // Deletion state managers
  const [isDeleteFolderModalOpen, setIsDeleteFolderModalOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [isDeleteSelectionConfirmOpen, setIsDeleteSelectionConfirmOpen] =
    useState(false);

  // Renaming folder states
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFolderTempName, setRenamingFolderTempName] = useState("");

  // Viewing detail state manager
  const [activeViewingPaper, setActiveViewingPaper] = useState<PaperItem | null>(
    null
  );

  // Dynamic sort and filter logic
  const allLibraryItems = [...papers];

  const filteredPapers = allLibraryItems.filter((p) => {
    const matchesSearch = searchFilter
      ? p.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (p.author &&
          p.author.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (p.summary &&
          p.summary.toLowerCase().includes(searchFilter.toLowerCase()))
      : true;

    const matchesType = filterType === "all" ? true : p.fileType === filterType;
    return matchesSearch && matchesType;
  });

  const sortedPapers = [...filteredPapers].sort((a, b) => {
    let valA = "";
    let valB = "";

    if (sortBy === "title") {
      valA = a.title || "";
      valB = b.title || "";
    } else if (sortBy === "added") {
      valA = a.added || "";
      valB = b.added || "";
    } else if (sortBy === "viewed") {
      valA = a.viewed || "";
      valB = b.viewed || "";
    }

    const orderMultiplier = sortOrder === "asc" ? 1 : -1;
    return valA.localeCompare(valB) * orderMultiplier;
  });

  // Folder papers for current view
  const folderPapers = selectedFolderId
    ? sortedPapers.filter((p) => p.folderId === selectedFolderId)
    : sortedPapers;

  return (
    <div className="flex-1 overflow-y-auto focus:outline-none bg-[#121212] flex flex-col">
      <div className="w-full px-[1px] py-6 flex-1 flex flex-col">
        {/* Header section */}
        <div className="flex items-center justify-between mb-8 px-4">
          <div>
            <h1 className="text-2xl text-[#f4f4f5] font-medium tracking-tight">
              {selectedFolderId
                ? folders.find((f) => f.id === selectedFolderId)?.name || lt("library", "Library")
                : lt("library", "Library")}
            </h1>
            {!selectedFolderId && (
              <p className="text-[#71717a] text-[11px] mt-1">
                {lt("desc", "Files, research assets, and citation repository")}
              </p>
            )}
          </div>

          <div className="relative w-64">
            <MinimalisticMagnifier
              weight="Linear"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 shrink-0"
            />
            <input
              type="text"
              placeholder={lt("search", "Search collection...")}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#27272a] rounded-lg pl-9 pr-3 py-1.5 text-zinc-200 text-xs focus:border-zinc-400 focus:outline-[#1a1a1a] focus:outline-none placeholder:text-zinc-600 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 select-none relative px-4 text-zinc-400">
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDisplayDropdownOpen(!isDisplayDropdownOpen);
                  setIsSortDropdownOpen(false);
                  setIsFilterDropdownOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 border rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                  isDisplayDropdownOpen
                    ? "bg-[#27272a] text-white border-zinc-500"
                    : "bg-[#1a1a1a] hover:bg-[#222222] border-[#27272a] text-[#e4e4e7]"
                }`}
              >
                <Icon icon="ph:rows" className="w-3.5 h-3.5" />
                <span>{lt("display", "Display")}</span>
              </button>
              {isDisplayDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDisplayDropdownOpen(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-44 bg-[#121212] border border-[#27272a] rounded-xl p-1.5 flex flex-col gap-0.5 shadow-xl z-50 text-xs text-zinc-300">
                    <div className="px-2.5 py-1 text-[9.5px] uppercase font-bold text-[#71717a] tracking-wider mb-0.5">
                      {lt("density", "Density")}
                    </div>
                    <button
                      onClick={() => {
                        setDisplayDensity("comfortable");
                        setIsDisplayDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>{lt("comfortable", "Comfortable")}</span>
                      {displayDensity === "comfortable" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setDisplayDensity("compact");
                        setIsDisplayDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>{lt("compact", "Compact")}</span>
                      {displayDensity === "compact" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSortDropdownOpen(!isSortDropdownOpen);
                  setIsDisplayDropdownOpen(false);
                  setIsFilterDropdownOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 border rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                  isSortDropdownOpen
                    ? "bg-[#27272a] text-white border-zinc-500"
                    : "bg-[#1a1a1a] hover:bg-[#222222] border-[#27272a] text-[#e4e4e7]"
                }`}
              >
                <Icon icon="ph:arrows-down-up" className="w-3.5 h-3.5" />
                <span>{lt("sort", "Sort")}</span>
              </button>
              {isSortDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsSortDropdownOpen(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-44 bg-[#121212] border border-[#27272a] rounded-xl p-1.5 flex flex-col gap-0.5 shadow-xl z-50 text-xs text-zinc-300">
                    <button
                      onClick={() => {
                        setSortBy("title");
                        setIsSortDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>{lt("title", "Title")}</span>
                      {sortBy === "title" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSortBy("added");
                        setIsSortDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>{lt("dateAdded", "Date Added")}</span>
                      {sortBy === "added" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSortBy("viewed");
                        setIsSortDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>{lt("lastViewed", "Last Viewed")}</span>
                      {sortBy === "viewed" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                    <div className="h-[1px] bg-[#27272a] my-1" />
                    <button
                      onClick={() => {
                        setSortOrder("asc");
                        setIsSortDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>{lt("ascending", "Ascending")}</span>
                      {sortOrder === "asc" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSortOrder("desc");
                        setIsSortDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>{lt("descending", "Descending")}</span>
                      {sortOrder === "desc" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFilterDropdownOpen(!isFilterDropdownOpen);
                  setIsDisplayDropdownOpen(false);
                  setIsSortDropdownOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 border rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                  isFilterDropdownOpen
                    ? "bg-[#27272a] text-white border-zinc-500"
                    : "bg-[#1a1a1a] hover:bg-[#222222] border-[#27272a] text-[#e4e4e7]"
                }`}
              >
                <Icon icon="ph:funnel" className="w-3.5 h-3.5" />
                <span>{lt("filter", "Filter")}</span>
              </button>
              {isFilterDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsFilterDropdownOpen(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-44 bg-[#121212] border border-[#27272a] rounded-xl p-1.5 flex flex-col gap-0.5 shadow-xl z-50 text-xs text-zinc-300">
                    <button
                      onClick={() => {
                        setFilterType("all");
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>{lt("all", "All Files")}</span>
                      {filterType === "all" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setFilterType("Note");
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>{lt("notes", "Notes")}</span>
                      {filterType === "Note" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setFilterType("Document");
                        setIsFilterDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#27272a] hover:text-white text-left transition-colors cursor-pointer"
                    >
                      <span>{lt("documents", "Documents")}</span>
                      {filterType === "Document" && (
                        <Icon icon="ph:check" className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:ml-auto text-xs w-full sm:w-auto justify-between sm:justify-end font-sans select-none">
            <span className="text-[#71717a] text-[11px] font-medium mr-1 select-none">
              {lt("filesInLibrary", "{num} files in library").replace("{num}", String(sortedPapers.length))}
            </span>
            <div className="relative font-jakarta">
              <button
                onClick={() => {
                  setIsAddDropdownOpen(!isAddDropdownOpen);
                  setAddDropdownNested(null);
                }}
                className={`flex items-center gap-1.5 px-4 py-1.5 font-semibold rounded-xl transition-all cursor-pointer ${
                  isAddDropdownOpen ? "bg-white text-zinc-950" : "bg-zinc-200 hover:bg-white text-zinc-950"
                }`}
              >
                <span className="text-[11px]">{lt("add", "Add")}</span>
                <Icon
                  icon="ph:caret-down"
                  className={`w-3 h-3 transition-transform ${isAddDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {isAddDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsAddDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-52 bg-[#18181b] border border-[#27272a] rounded-xl p-1.5 flex flex-col gap-0.5 z-[60] shadow-2xl"
                    >
                      <button
                        onClick={() => {
                          createNewDocument();
                          setIsAddDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                      >
                        <Notes
                          weight="Linear"
                          className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300"
                        />
                        <span className="font-medium">{lt("addDoc", "New document")}</span>
                      </button>

                      <button
                        onClick={() => {
                          fileInputRef.current?.click();
                          setIsAddDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                      >
                        <UploadMinimalistic
                          weight="Linear"
                          className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 shrink-0"
                        />
                        <span className="font-medium">{lt("fileUpload", "File upload")}</span>
                      </button>

                      <button
                        onClick={() => {
                          const newFolderId = `folder-${Date.now()}`;
                          dbSetFolder({
                            id: newFolderId,
                            name: lt("newFolder", "New folder"),
                            createdAt: Date.now(),
                          });
                          setIsAddDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group"
                      >
                        <AddFolder
                          weight="Linear"
                          className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 shrink-0"
                        />
                        <span className="font-medium">{lt("newFolder", "New folder")}</span>
                      </button>

                      <div className="h-[1px] bg-[#27272a] mx-2 my-0.5" />

                      <a
                        href="https://genlang.vercel.app/#blog-post/file-types"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer group no-underline"
                      >
                        <Icon
                          icon="ph:info"
                          className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 shrink-0"
                        />
                        <span className="font-medium">{lt("learnFileTypes", "Learn about File Types")}</span>
                      </a>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Library body */}
        <div className="flex-1 min-h-0 flex flex-col">
          {!selectedFolderId ? (
            // Folder Grid and Directory Layout
            <div className="px-4">
              <h2 className="text-[#a1a1aa] text-[10px] font-bold tracking-widest uppercase mb-4">
                {lt("researchFolders", "Research Folders")}
              </h2>

              <div className="bg-[#121212] overflow-x-auto border border-[#27272a] rounded-xl mb-8">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#27272a] bg-[#1a1a1a]/40 text-[#71717a] text-[10.5px] font-jakarta tracking-wider uppercase">
                      <th className="pl-6 pr-3 py-3 font-semibold text-[#8a8a93]">
                        {lt("folderName", "Folder Name")}
                      </th>
                      <th className="py-3 px-3 font-semibold text-[#8a8a93]">
                        {lt("size", "Size")}
                      </th>
                      <th className="py-3 px-3 font-semibold text-[#8a8a93]">
                        {lt("created", "Created")}
                      </th>
                      <th className="pr-6 pl-3 py-3 w-[120px] text-right font-semibold text-[#8a8a93]">
                        {lt("actions", "Actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1e20] text-xs">
                    {folders.map((folder) => {
                      const folderFiles = papers.filter(
                        (p) => p.folderId === folder.id
                      );
                      return (
                        <tr
                          key={folder.id}
                          onClick={() => setSelectedFolderId(folder.id)}
                          draggable
                          onDragStart={(e) =>
                            handleLibraryDragStart(e, "folder", folder.id)
                          }
                          onDragOver={(e) =>
                            handleLibraryDragOverFolder(e, folder.id)
                          }
                          onDragLeave={handleFolderDragLeave}
                          onDrop={(e) => handleLibraryDropOnFolder(e, folder.id)}
                          className={`transition-colors group cursor-pointer ${
                            dragOverFolderId === folder.id
                              ? "bg-zinc-800/60 border-y border-zinc-500"
                              : "hover:bg-[#1a1a1a]/40"
                          }`}
                        >
                          <td
                            className={`pl-6 pr-3 font-medium ${
                              displayDensity === "compact" ? "py-1.5" : "py-3.5"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <FolderWithFiles
                                weight="Linear"
                                className="w-4 h-4 text-zinc-400 shrink-0"
                              />
                              {renamingFolderId === folder.id ? (
                                <input
                                  autoFocus
                                  value={renamingFolderTempName}
                                  onChange={(e) =>
                                    setRenamingFolderTempName(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      dbSetFolder({
                                        ...folder,
                                        name:
                                          renamingFolderTempName.trim() ||
                                          lt("newFolder", "New folder"),
                                      });
                                      setRenamingFolderId(null);
                                    } else if (e.key === "Escape") {
                                      setRenamingFolderId(null);
                                    }
                                  }}
                                  onBlur={() => {
                                    dbSetFolder({
                                      ...folder,
                                      name:
                                        renamingFolderTempName.trim() ||
                                        lt("newFolder", "New folder"),
                                    });
                                    setRenamingFolderId(null);
                                  }}
                                  className="bg-[#1a1a1a] border border-[#27272a] text-zinc-300 text-xs rounded px-2 py-0.5 focus:outline-none focus:border-zinc-500 w-full max-w-[200px]"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span className="text-[#f4f4f5] max-w-[300px] truncate">
                                  {folder.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className={`px-3 text-zinc-400 font-jakarta ${
                              displayDensity === "compact" ? "py-1.5" : "py-3.5"
                            }`}
                          >
                            {folderFiles.length} {folderFiles.length === 1 ? lt("item", "item") : lt("items", "items")}
                          </td>
                          <td
                            className={`px-3 text-zinc-500 ${
                              displayDensity === "compact" ? "py-1.5" : "py-3.5"
                            }`}
                          >
                            {new Date(folder.createdAt).toLocaleDateString()}
                          </td>
                          <td
                            className={`pr-6 pl-3 ${
                              displayDensity === "compact" ? "py-1.5" : "py-3.5"
                            }`}
                          >
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingFolderId(folder.id);
                                  setRenamingFolderTempName(folder.name);
                                }}
                                className="p-1.5 hover:bg-[#27272a] rounded text-zinc-400 hover:text-white transition-colors"
                                title={lt("renameFolder", "Rename Folder")}
                              >
                                <PenNewRound
                                  weight="Linear"
                                  className="w-3.5 h-3.5"
                                />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFolderToDelete(folder);
                                  setIsDeleteFolderModalOpen(true);
                                }}
                                className="p-1.5 hover:bg-[#27272a] rounded text-red-400 hover:text-red-350 transition-colors"
                                title={lt("deleteFolder", "Delete Folder")}
                              >
                                <Icon icon="ph:trash" className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            // Deep Folder Contents Viewer
            <div className="flex-1 flex flex-col px-4">
              {/* Navigation Path */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setSelectedFolderId(null)}
                  onDragOver={handleLibraryDragOverRoot}
                  onDragLeave={() => setDragOverRootLibrary(false)}
                  onDrop={handleLibraryDropOnRoot}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors cursor-pointer border ${
                    dragOverRootLibrary
                      ? "border-zinc-500 bg-zinc-800/40 text-white font-semibold"
                      : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  <Icon icon="ph:caret-left" className="w-3.5 h-3.5" />
                  <span>{lt("allFolders", "All Folders")}</span>
                </button>
                <span className="text-[#27272a] text-xs">/</span>
                <div className="flex items-center gap-2">
                  <FolderWithFiles
                    weight="Linear"
                    className="w-3.5 h-3.5 text-zinc-400 shrink-0"
                  />
                  <span className="text-xs font-semibold text-white">
                    {folders.find((f) => f.id === selectedFolderId)?.name ||
                      lt("browsingDir", "Browsing Directory")}
                  </span>
                </div>
              </div>

              {/* Filtered Folder Papers */}
              {folderPapers.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-[#27272a] rounded-xl bg-[#161616]/20">
                  <FolderWithFiles
                    weight="Linear"
                    className="w-10 h-10 text-zinc-600 mx-auto mb-4 shrink-0"
                  />
                  <h3 className="text-[#e4e4e7] text-sm font-medium mb-1">
                    {lt("folderEmpty", "Folder is Empty")}
                  </h3>
                  <p className="text-[#52525b] text-xs max-w-sm mx-auto mb-4">
                    {lt("folderEmptyDesc", "No assets have been added here yet. Create some research notes or export Summaries to fill it!")}
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() =>
                        createNewDocument(selectedFolderId || folders[0]?.id)
                      }
                      className="px-6 py-2 bg-[#e4e4e7] hover:bg-white text-black rounded-full text-xs font-bold cursor-pointer transition-colors shadow-sm"
                    >
                      {lt("addDoc", "New document")}
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-2 bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] text-[#f4f4f5] rounded-full text-xs font-bold cursor-pointer transition-colors"
                    >
                      {lt("uploadPdf", "Upload PDF File")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#121212] overflow-x-auto border border-[#27272a] rounded-xl min-h-[260px]">
                  <table className="w-full text-left border-collapse min-w-[950px]">
                    <thead>
                      <tr className="border-b border-[#27272a] bg-[#1a1a1a]/40 text-[#71717a] text-[10.5px] font-jakarta tracking-wider uppercase">
                        <th className="w-[44px] pl-4 py-3">
                          <button
                            onClick={() => {
                              const folderNames = folderPapers.map((p) => p.title);
                              const allSelected = folderNames.every((name) =>
                                selectedPapers.includes(name)
                              );
                              if (allSelected) {
                                setSelectedPapers(
                                  selectedPapers.filter((name) => !folderNames.includes(name))
                                );
                              } else {
                                setSelectedPapers([
                                  ...new Set([...selectedPapers, ...folderNames]),
                                ]);
                              }
                            }}
                            className="w-3.5 h-3.5 rounded-sm border border-[#27272a] bg-[#1a1a1a] flex items-center justify-center hover:border-zinc-500 transition-colors cursor-pointer"
                          >
                            {folderPapers
                              .map((p) => p.title)
                              .every((name) => selectedPapers.includes(name)) ? (
                              <div className="w-1.5 h-1.5 bg-zinc-200 rounded-[1px]" />
                            ) : folderPapers.some((p) => selectedPapers.includes(p.title)) ? (
                              <div className="w-1.5 h-[1px] bg-zinc-400" />
                            ) : null}
                          </button>
                        </th>
                        <th className="py-3 px-3 font-semibold text-[#8a8a93]">{lt("title", "Title")}</th>
                        <th className="py-3 px-3 font-semibold text-[#8a8a93]">{lt("folder", "Folder")}</th>
                        <th className="py-3 px-3 font-semibold text-[#8a8a93]">{lt("authors", "Authors")}</th>
                        <th className="py-3 px-3 font-semibold text-[#8a8a93]">{lt("added", "Added")}</th>
                        <th className="py-3 px-3 font-semibold text-[#8a8a93]">{lt("viewed", "Viewed")}</th>
                        <th className="py-3 px-3 font-semibold text-[#8a8a93]">{lt("type", "Type")}</th>
                        <th className="py-3 px-3 font-semibold text-[#8a8a93]">{lt("summary", "Summary")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e1e20] text-xs">
                      {folderPapers.map((paper, idx) => {
                        const isChecked = selectedPapers.includes(paper.title);
                        const openUpward = idx > 0 && idx >= folderPapers.length - 2;
                        return (
                          <tr
                            key={idx}
                            onClick={() => handlePaperClick(paper)}
                            draggable
                            onDragStart={(e) =>
                              handleLibraryDragStart(e, "paper", paper.title, paper.title)
                            }
                            className={`hover:bg-[#1a1a1a]/40 transition-colors group cursor-pointer ${
                              isChecked ? "bg-[#1a1a1a]/25" : ""
                            }`}
                          >
                            <td
                              className={`w-[44px] pl-4 ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isChecked) {
                                  setSelectedPapers(
                                    selectedPapers.filter((t) => t !== paper.title)
                                  );
                                } else {
                                  setSelectedPapers([...selectedPapers, paper.title]);
                                }
                              }}
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded-sm border border-[#27272a] flex items-center justify-center transition-colors ${
                                  isChecked ? "bg-zinc-200 border-zinc-200" : "bg-[#1a1a1a]"
                                }`}
                              >
                                {isChecked && (
                                  <Icon
                                    icon="ph:check"
                                    className="w-2.5 h-2.5 text-[#121212]"
                                  />
                                )}
                              </div>
                            </td>
                            <td
                              className={`px-3 font-medium ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                {paper.fileType === "Note" ? (
                                  <Icon
                                    icon="ph:file-text"
                                    className="w-4 h-4 text-zinc-400"
                                  />
                                ) : (
                                  <Icon
                                    icon="ph:article"
                                    className="w-4 h-4 text-zinc-300"
                                  />
                                )}
                                <span className="text-[#f4f4f5] truncate max-w-[240px]">
                                  {paper.title}
                                </span>
                              </div>
                            </td>
                            <td
                              className={`px-3 ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div
                                className="relative inline-flex items-center"
                                tabIndex={0}
                                onBlur={(e) => {
                                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                    setActiveMoveFolderDropdown(null);
                                  }
                                }}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMoveFolderDropdown(
                                      activeMoveFolderDropdown === paper.title ? null : paper.title
                                    );
                                  }}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer w-full min-w-[130px] max-w-[140px] justify-between ${
                                    activeMoveFolderDropdown === paper.title
                                      ? "bg-[#27272a] text-white"
                                      : "bg-transparent text-zinc-300 hover:bg-[#27272a] hover:text-white"
                                  }`}
                                >
                                  <span className="text-[11px] truncate">
                                    {paper.folderId
                                      ? folders.find((f) => f.id === paper.folderId)?.name ||
                                        lt("library", "Library")
                                      : lt("library", "Library")}
                                  </span>
                                  <Icon
                                    icon="ph:caret-down"
                                    className={`w-3 h-3 shrink-0 transition-transform ${
                                      activeMoveFolderDropdown === paper.title ? "rotate-180" : ""
                                    }`}
                                  />
                                </button>

                                <AnimatePresence>
                                  {activeMoveFolderDropdown === paper.title && (
                                    <motion.div
                                      initial={{
                                        opacity: 0,
                                        y: openUpward ? -4 : 4,
                                        scale: 0.95,
                                      }}
                                      animate={{
                                        opacity: 1,
                                        y: 0,
                                        scale: 1,
                                      }}
                                      exit={{
                                        opacity: 0,
                                        y: openUpward ? -4 : 4,
                                        scale: 0.95,
                                      }}
                                      transition={{ duration: 0.1 }}
                                      className={`absolute left-0 ${
                                        openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
                                      } w-48 bg-[#18181b] border border-[#27272a] rounded-xl py-1.5 z-[70] shadow-2xl`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={() => {
                                          dbSetPaper({ ...paper, folderId: "" });
                                          setActiveMoveFolderDropdown(null);
                                        }}
                                        className="w-full flex items-center px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer text-left font-medium"
                                      >
                                        {lt("library", "Library")}
                                      </button>
                                      {folders.map((folder) => (
                                        <button
                                          key={folder.id}
                                          onClick={() => {
                                            dbSetPaper({ ...paper, folderId: folder.id });
                                            setActiveMoveFolderDropdown(null);
                                          }}
                                          className="w-full flex items-center px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer text-left truncate font-medium"
                                        >
                                          {folder.name}
                                        </button>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </td>
                            <td
                              className={`px-3 text-zinc-400 ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                            >
                              {paper.author || "—"}
                            </td>
                            <td
                              className={`px-3 text-zinc-500 ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                            >
                              {paper.added || "—"}
                            </td>
                            <td
                              className={`px-3 text-zinc-500 ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                            >
                              {paper.viewed || "—"}
                            </td>
                            <td
                              className={`px-3 text-zinc-400 capitalize ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                            >
                              {paper.fileType || "—"}
                            </td>
                            <td
                              className={`px-3 text-[#52525b] ${
                                displayDensity === "compact" ? "py-1.5" : "py-3.5"
                              }`}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveViewingPaper(paper);
                                }}
                                className="px-2.5 py-1 bg-transparent hover:bg-[#27272a] text-zinc-300 hover:text-white font-sans text-[11px] rounded-lg transition-all cursor-pointer flex items-center gap-1.5 font-medium select-none"
                              >
                                <Icon icon="ph:eye" className="w-3.5 h-3.5" />
                                <span>{lt("summary", "Summary")}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Selection Pill */}
      <AnimatePresence>
        {selectedPapers.length > 0 && (
          <motion.div
            initial={{ y: 20, x: "-50%", opacity: 0 }}
            animate={{ y: 0, x: "-50%", opacity: 1 }}
            exit={{ y: 20, x: "-50%", opacity: 0 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 350,
            }}
            className="fixed bottom-10 left-1/2 z-50 flex items-center gap-6 px-6 py-3 bg-[#111112] border border-[#27272a] rounded-full select-none font-jakarta shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-[#0070f3] rounded flex items-center justify-center">
                <Icon icon="ph:check-bold" className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="text-sm text-white whitespace-nowrap">
                {selectedPapers.length} {selectedPapers.length === 1 ? "file" : "files"} selected
              </span>
            </div>

            <div className="flex items-center gap-1">
              {selectedPapers.length === 1 && (
                <button
                  onClick={() => {
                    const match = papers.find((p) => p.title === selectedPapers[0]);
                    if (match) {
                      setActiveViewingPaper(match);
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#1a1a1a] rounded-lg text-white text-[13px] transition-colors cursor-pointer"
                >
                  <Icon icon="ph:eye" className="w-4 h-4 text-zinc-400" />
                  <span>View Summary</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsDeleteSelectionConfirmOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#1a1a1a] rounded-lg text-white text-[13px] transition-colors cursor-pointer"
              >
                <span>Delete selection</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlays / Modals */}
      <AnimatePresence>
        {/* Paper Summary Drawer Modal */}
        {activeViewingPaper && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-black/75 z-[10500] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] border border-[#27272a] rounded-2xl w-full max-w-2xl p-6 relative text-zinc-300"
            >
              <button
                onClick={() => setActiveViewingPaper(null)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <Icon icon="ph:x" className="w-5 h-5" />
              </button>

              <h3 className="text-[#f4f4f5] text-xl font-medium leading-snug mb-1 pr-6">
                {activeViewingPaper.title}
              </h3>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#71717a] border-b border-[#27272a] pb-4 mb-4">
                {activeViewingPaper.author && (
                  <div className="flex items-center gap-1">
                    <Icon icon="ph:user" className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{activeViewingPaper.author}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Icon icon="ph:calendar" className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Added: {activeViewingPaper.added || "Today"}</span>
                </div>
                {activeViewingPaper.url && (
                  <a
                    href={activeViewingPaper.url}
                    target="_blank"
                    rel="noreferrer"
                    referrerPolicy="no-referrer"
                    className="flex items-center gap-1 text-[#0070f3] hover:underline"
                  >
                    <Icon icon="ph:link" className="w-3.5 h-3.5" />
                    <span className="truncate max-w-xs">{activeViewingPaper.url}</span>
                  </a>
                )}
              </div>

              <div className="space-y-4 text-sm leading-relaxed max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                {activeViewingPaper.summary ? (
                  <div className="markdown-body prose prose-invert max-w-none text-sm text-[#d4d4d8] font-sans">
                    <ReactMarkdown>
                      {formatAbstractText(activeViewingPaper.summary).replace(/\\n/g, "\n")}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-[#d4d4d8] font-sans whitespace-pre-wrap">
                    {activeViewingPaper.description
                      ? formatAbstractText(activeViewingPaper.description).replace(/\\n/g, "\n")
                      : ""}
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center gap-4 mt-6 pt-4 border-t border-[#27272a]">
                <button
                  onClick={() => {
                    const summaryText =
                      activeViewingPaper.summary || activeViewingPaper.description || "";
                    navigator.clipboard.writeText(summaryText);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-[#27272a] hover:bg-[#1a1a1a] rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
                >
                  <Icon icon="ph:copy" className="w-3.5 h-3.5" />
                  <span>Copy Summary</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveViewingPaper(null)}
                    className="px-5 py-2.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Delete Selection Modal */}
        {isDeleteSelectionConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-black/80 z-[10600] flex items-center justify-center p-4 backdrop-blur-sm px-4"
            onClick={() => setIsDeleteSelectionConfirmOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1c1c1e] border border-zinc-800 rounded-[20px] w-full max-w-[320px] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-2 text-left">Delete Selection?</h3>
                <p className="text-zinc-400 text-[13px] leading-normal mb-6 text-left font-sans">
                  Are you sure you want to delete the selected{" "}
                  {selectedPapers.length === 1 ? "document" : "documents"}? This will permanently
                  remove them from your library.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setIsDeleteSelectionConfirmOpen(false)}
                    className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full text-xs font-semibold cursor-pointer transition-colors border border-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      selectedPapers.forEach((title) => dbDeletePaper(title));
                      setSelectedPapers([]);
                      setIsDeleteSelectionConfirmOpen(false);
                    }}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs font-semibold transition-all cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Folder Deletion Modal */}
        {isDeleteFolderModalOpen && folderToDelete && (
          <div
            className="fixed inset-0 z-[10600] flex items-center justify-center bg-black/85 p-4"
            onClick={() => setIsDeleteFolderModalOpen(false)}
          >
            <div
              className="bg-[#1c1c1e] border border-zinc-800 rounded-[20px] w-full max-w-[320px] overflow-hidden shadow-2xl animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-bold text-white mb-2 text-left">Delete Folder?</h3>
                <p className="text-zinc-400 text-[13px] leading-normal mb-6 text-left">
                  Are you sure you want to delete{" "}
                  <span className="text-zinc-200 font-semibold">"{folderToDelete.name}"</span>? All
                  documents indexed within this folder will be removed.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setIsDeleteFolderModalOpen(false)}
                    className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full text-xs font-semibold cursor-pointer transition-colors border border-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      dbDeleteFolder(folderToDelete.id);
                      setIsDeleteFolderModalOpen(false);
                      setFolderToDelete(null);
                    }}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs font-semibold transition-all cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
