import { BiRegularLeftArrowAlt, BiRegularRightArrowAlt } from "solid-icons/bi";
import { CgSpinner } from "solid-icons/cg";
import { FaRegularBookmark, FaSolidBookmark } from "solid-icons/fa";
import {
    TbFillAlertSquareRounded,
    TbFillBrandPatreon,
    TbFillFidgetSpinner,
    TbFillSquareRoundedCheck,
    TbOutlineArrowRight,
    TbOutlineArrowUpRight,
    TbOutlineBan,
    TbOutlineBookmark,
    TbOutlineChevronDown,
    TbOutlineClock,
    TbOutlineLayoutBottombar,
    TbOutlineLayoutNavbar,
    TbOutlineLayoutSidebar,
    TbOutlineLayoutSidebarRight,
    TbOutlineLink,
    TbOutlineLoader,
    TbOutlineLoader2,
    TbOutlineLock,
    TbOutlinePlus,
    TbOutlinePuzzle,
    TbOutlineRefresh,
    TbOutlineSearch,
    TbOutlineTrash,
    TbOutlineUpload,
    TbOutlineWorld,
    TbOutlineX,
} from "solid-icons/tb";

/**
 * The app's icon vocabulary, named by meaning rather than by vendor.
 *
 * Every component in the app imports from here. That is the entire purpose:
 * a custom icon set is being drawn separately, and when it lands this file is
 * the only one that changes. Importing `solid-icons/tb` directly anywhere else
 * defeats it — a lint-free way to reintroduce a 17-file migration.
 *
 * Names describe the job ("close", "world"), not the glyph or the pack, so a
 * replacement drawing does not have to imitate Tabler's shapes.
 */

export const IconAlert = TbFillAlertSquareRounded;
export const IconArrowLeft = BiRegularLeftArrowAlt;
export const IconArrowRight = TbOutlineArrowRight;
export const IconArrowUpRight = TbOutlineArrowUpRight;
export const IconBan = TbOutlineBan;
export const IconBookmark = TbOutlineBookmark;
export const IconBookmarkFilled = FaSolidBookmark;
export const IconBookmarkOutline = FaRegularBookmark;
export const IconCheck = TbFillSquareRoundedCheck;
export const IconChevronDown = TbOutlineChevronDown;
export const IconClock = TbOutlineClock;
export const IconClose = TbOutlineX;
export const IconForward = BiRegularRightArrowAlt;
export const IconLayoutBottom = TbOutlineLayoutBottombar;
export const IconLayoutNavbar = TbOutlineLayoutNavbar;
export const IconLayoutSidebar = TbOutlineLayoutSidebar;
export const IconLayoutSidebarRight = TbOutlineLayoutSidebarRight;
export const IconLink = TbOutlineLink;
export const IconLoader = TbOutlineLoader;
export const IconLoaderDots = TbOutlineLoader2;
export const IconLock = TbOutlineLock;
export const IconPatreon = TbFillBrandPatreon;
export const IconPlus = TbOutlinePlus;
export const IconPuzzle = TbOutlinePuzzle;
export const IconRefresh = TbOutlineRefresh;
export const IconSearch = TbOutlineSearch;
export const IconSpinner = CgSpinner;
export const IconSpinnerFilled = TbFillFidgetSpinner;
export const IconTrash = TbOutlineTrash;
export const IconUpload = TbOutlineUpload;
export const IconWorld = TbOutlineWorld;
