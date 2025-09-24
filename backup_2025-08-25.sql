--
-- PostgreSQL database dump
--

-- Dumped from database version 12.22 (Ubuntu 12.22-0ubuntu0.20.04.4)
-- Dumped by pg_dump version 12.22 (Ubuntu 12.22-0ubuntu0.20.04.4)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: channel_enum; Type: TYPE; Schema: public; Owner: patrick
--

CREATE TYPE public.channel_enum AS ENUM (
    'sms',
    'email'
);


ALTER TYPE public.channel_enum OWNER TO patrick;

--
-- Name: estimate_method; Type: TYPE; Schema: public; Owner: patrick
--

CREATE TYPE public.estimate_method AS ENUM (
    'inventory',
    'size',
    'hourly'
);


ALTER TYPE public.estimate_method OWNER TO patrick;

--
-- Name: move_service_enum; Type: TYPE; Schema: public; Owner: patrick
--

CREATE TYPE public.move_service_enum AS ENUM (
    'moving',
    'packing',
    'moving and packing',
    'moving and storage',
    'loading only',
    'unload only',
    'in home move',
    'piano move',
    'safe move'
);


ALTER TYPE public.move_service_enum OWNER TO patrick;

--
-- Name: move_type_enum; Type: TYPE; Schema: public; Owner: patrick
--

CREATE TYPE public.move_type_enum AS ENUM (
    'house',
    'apartment',
    'commercial',
    'storage'
);


ALTER TYPE public.move_type_enum OWNER TO patrick;

--
-- Name: residence_type; Type: TYPE; Schema: public; Owner: patrick
--

CREATE TYPE public.residence_type AS ENUM (
    'apartment',
    'house_bedrooms',
    'house_sqft',
    'storage'
);


ALTER TYPE public.residence_type OWNER TO patrick;

--
-- Name: sender_type_enum; Type: TYPE; Schema: public; Owner: patrick
--

CREATE TYPE public.sender_type_enum AS ENUM (
    'agent',
    'customer',
    'system'
);


ALTER TYPE public.sender_type_enum OWNER TO patrick;

--
-- Name: log_customers_changes(); Type: FUNCTION; Schema: public; Owner: patrick
--

CREATE FUNCTION public.log_customers_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF OLD.name != NEW.name THEN
            INSERT INTO audit_logs (table_name, record_id, column_name, old_value, new_value, changed_by)
            VALUES ('customers', OLD.id, 'name', OLD.name, NEW.name, CURRENT_USER);
        END IF;
        IF OLD.email != NEW.email THEN
            INSERT INTO audit_logs (table_name, record_id, column_name, old_value, new_value, changed_by)
            VALUES ('customers', OLD.id, 'email', OLD.email, NEW.email, CURRENT_USER);
        END IF;
        IF OLD.phone != NEW.phone THEN
            INSERT INTO audit_logs (table_name, record_id, column_name, old_value, new_value, changed_by)
            VALUES ('customers', OLD.id, 'phone', OLD.phone, NEW.phone, CURRENT_USER);
        END IF;
        IF OLD.company_name != NEW.company_name THEN
            INSERT INTO audit_logs (table_name, record_id, column_name, old_value, new_value, changed_by)
            VALUES ('customers', OLD.id, 'company_name', OLD.company_name, NEW.company_name, CURRENT_USER);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.log_customers_changes() OWNER TO patrick;

--
-- Name: log_delete_audit(); Type: FUNCTION; Schema: public; Owner: patrick
--

CREATE FUNCTION public.log_delete_audit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO audit_logs (table_name, record_id, column_name, old_value, new_value, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'deleted', OLD::text, NULL, CURRENT_USER);
    RETURN OLD;
END;
$$;


ALTER FUNCTION public.log_delete_audit() OWNER TO patrick;

--
-- Name: log_estimates_changes(); Type: FUNCTION; Schema: public; Owner: patrick
--

CREATE FUNCTION public.log_estimates_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF OLD.notes != NEW.notes THEN
            INSERT INTO audit_logs (table_name, record_id, column_name, old_value, new_value, changed_by)
            VALUES ('opportunities', OLD.id, 'notes', OLD.notes, NEW.notes, CURRENT_USER);
        END IF;
        IF OLD.move_date != NEW.move_date THEN
            INSERT INTO audit_logs (table_name, record_id, column_name, old_value, new_value, changed_by)
            VALUES ('opportunities', OLD.id, 'move_date', OLD.move_date::text, NEW.move_date::text, CURRENT_USER);
        END IF;
        IF OLD.move_type != NEW.move_type THEN
            INSERT INTO audit_logs (table_name, record_id, column_name, old_value, new_value, changed_by)
            VALUES ('opportunities', OLD.id, 'move_type', OLD.move_type, NEW.move_type, CURRENT_USER);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.log_estimates_changes() OWNER TO patrick;

--
-- Name: populate_item_details(); Type: FUNCTION; Schema: public; Owner: patrick
--

CREATE FUNCTION public.populate_item_details() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT weight_lbs, volume_cf INTO NEW.weight_lbs_per_item, NEW.volume_cf_per_item
    FROM inventory_items WHERE id = NEW.inventory_item_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.populate_item_details() OWNER TO patrick;

--
-- Name: populate_residence_details(); Type: FUNCTION; Schema: public; Owner: patrick
--

CREATE FUNCTION public.populate_residence_details() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    SELECT weight_lbs INTO NEW.weight_lbs_per_unit
    FROM residence_sizes WHERE id = NEW.residence_size_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.populate_residence_details() OWNER TO patrick;

--
-- Name: update_additional_service_totals(); Type: FUNCTION; Schema: public; Owner: patrick
--

CREATE FUNCTION public.update_additional_service_totals() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    unit_price DECIMAL(10,2);
BEGIN
    SELECT price INTO unit_price FROM additional_services WHERE id = NEW.additional_service_id;
    IF unit_price IS NULL THEN
        RAISE EXCEPTION 'Additional service not found';
    END IF;
    NEW.price_per_unit = unit_price;
    NEW.total_price = unit_price * NEW.quantity;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_additional_service_totals() OWNER TO patrick;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: additional_services; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.additional_services (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    movers_required integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.additional_services OWNER TO patrick;

--
-- Name: additional_services_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.additional_services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.additional_services_id_seq OWNER TO patrick;

--
-- Name: additional_services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.additional_services_id_seq OWNED BY public.additional_services.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    table_name character varying(50) NOT NULL,
    record_id integer NOT NULL,
    column_name character varying(50) NOT NULL,
    old_value text,
    new_value text,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    changed_by character varying(100)
);


ALTER TABLE public.audit_logs OWNER TO patrick;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.audit_logs_id_seq OWNER TO patrick;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50),
    company_name character varying(255),
    source character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tenant_id integer DEFAULT 1
);


ALTER TABLE public.customers OWNER TO patrick;

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.customers_id_seq OWNER TO patrick;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: estimate_additional_services; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.estimate_additional_services (
    id integer NOT NULL,
    estimate_id integer NOT NULL,
    additional_service_id integer NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    price_per_unit numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.estimate_additional_services OWNER TO patrick;

--
-- Name: estimate_additional_services_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.estimate_additional_services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.estimate_additional_services_id_seq OWNER TO patrick;

--
-- Name: estimate_additional_services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.estimate_additional_services_id_seq OWNED BY public.estimate_additional_services.id;


--
-- Name: estimate_inventory_items; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.estimate_inventory_items (
    id integer NOT NULL,
    estimate_id integer NOT NULL,
    inventory_item_id integer NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    weight_lbs_per_item numeric(10,2),
    volume_cf_per_item numeric(10,2),
    total_weight numeric(10,2) GENERATED ALWAYS AS (((quantity)::numeric * weight_lbs_per_item)) STORED,
    total_volume numeric(10,2) GENERATED ALWAYS AS (((quantity)::numeric * volume_cf_per_item)) STORED,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.estimate_inventory_items OWNER TO patrick;

--
-- Name: estimate_inventory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.estimate_inventory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.estimate_inventory_items_id_seq OWNER TO patrick;

--
-- Name: estimate_inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.estimate_inventory_items_id_seq OWNED BY public.estimate_inventory_items.id;


--
-- Name: estimate_residence_sizes; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.estimate_residence_sizes (
    id integer NOT NULL,
    estimate_id integer NOT NULL,
    residence_size_id integer NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    weight_lbs_per_unit numeric(10,2),
    total_weight numeric(10,2) GENERATED ALWAYS AS (((quantity)::numeric * weight_lbs_per_unit)) STORED,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.estimate_residence_sizes OWNER TO patrick;

--
-- Name: estimate_residence_sizes_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.estimate_residence_sizes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.estimate_residence_sizes_id_seq OWNER TO patrick;

--
-- Name: estimate_residence_sizes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.estimate_residence_sizes_id_seq OWNED BY public.estimate_residence_sizes.id;


--
-- Name: estimates; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.estimates (
    id integer NOT NULL,
    customer_id integer,
    move_date date,
    move_type public.move_type_enum,
    move_service public.move_service_enum,
    origin_address text,
    destination_address text,
    origin_stairs boolean DEFAULT false,
    dest_stairs boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text,
    status text DEFAULT 'new lead'::text,
    tenant_id integer DEFAULT 1,
    method public.estimate_method,
    total_weight numeric(10,2),
    total_volume numeric(10,2),
    estimated_hours numeric(5,2),
    labor_cost numeric(10,2),
    truck_cost numeric(10,2),
    fuel_cost numeric(10,2),
    additional_services_cost numeric(10,2),
    total_cost numeric(10,2),
    number_of_movers integer,
    distance_miles numeric(10,2),
    number_of_trucks integer,
    travel_time numeric(5,2),
    origin_city text,
    origin_state text,
    origin_zip text,
    destination_city text,
    destination_state text,
    destination_zip text
);


ALTER TABLE public.estimates OWNER TO patrick;

--
-- Name: estimates_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.estimates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.estimates_id_seq OWNER TO patrick;

--
-- Name: estimates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.estimates_id_seq OWNED BY public.estimates.id;


--
-- Name: fuel_price_tiers; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.fuel_price_tiers (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    miles_min numeric(10,2) NOT NULL,
    miles_max numeric(10,2),
    price_per_gallon numeric(5,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.fuel_price_tiers OWNER TO patrick;

--
-- Name: fuel_price_tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.fuel_price_tiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.fuel_price_tiers_id_seq OWNER TO patrick;

--
-- Name: fuel_price_tiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.fuel_price_tiers_id_seq OWNED BY public.fuel_price_tiers.id;


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.inventory_items (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    name character varying(255) NOT NULL,
    weight_lbs numeric(10,2) NOT NULL,
    volume_cf numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    description text,
    room character varying(255)
);


ALTER TABLE public.inventory_items OWNER TO patrick;

--
-- Name: inventory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.inventory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.inventory_items_id_seq OWNER TO patrick;

--
-- Name: inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.inventory_items_id_seq OWNED BY public.inventory_items.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    sender_type public.sender_type_enum NOT NULL,
    channel public.channel_enum DEFAULT 'sms'::public.channel_enum NOT NULL,
    content text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_read boolean DEFAULT false,
    tenant_id integer,
    tracking_id character varying(255),
    read_at timestamp without time zone,
    opportunity_id integer
);


ALTER TABLE public.messages OWNER TO patrick;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.messages_id_seq OWNER TO patrick;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: mover_assignment_rules; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.mover_assignment_rules (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    hours_min numeric(5,2) NOT NULL,
    hours_max numeric(5,2) NOT NULL,
    number_of_movers integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.mover_assignment_rules OWNER TO patrick;

--
-- Name: mover_assignment_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.mover_assignment_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.mover_assignment_rules_id_seq OWNER TO patrick;

--
-- Name: mover_assignment_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.mover_assignment_rules_id_seq OWNED BY public.mover_assignment_rules.id;


--
-- Name: mover_teams; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.mover_teams (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    number_of_movers integer NOT NULL,
    lbs_per_hour numeric(10,2) NOT NULL,
    price_per_hour numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.mover_teams OWNER TO patrick;

--
-- Name: mover_teams_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.mover_teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.mover_teams_id_seq OWNER TO patrick;

--
-- Name: mover_teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.mover_teams_id_seq OWNED BY public.mover_teams.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.permissions OWNER TO patrick;

--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.permissions_id_seq OWNER TO patrick;

--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(512) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL
);


ALTER TABLE public.refresh_tokens OWNER TO postgres;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.refresh_tokens_id_seq OWNER TO postgres;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: residence_sizes; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.residence_sizes (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    type public.residence_type NOT NULL,
    size_description character varying(255) NOT NULL,
    weight_lbs numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.residence_sizes OWNER TO patrick;

--
-- Name: residence_sizes_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.residence_sizes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.residence_sizes_id_seq OWNER TO patrick;

--
-- Name: residence_sizes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.residence_sizes_id_seq OWNED BY public.residence_sizes.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO patrick;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.roles OWNER TO patrick;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.roles_id_seq OWNER TO patrick;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.tenants (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    phone_number character varying(20),
    email character varying(255),
    logo_url character varying(255),
    address character varying(500),
    timezone character varying(50),
    google_maps_api_key character varying(255),
    enable_communications boolean DEFAULT false,
    primary_color text DEFAULT '#ff4f00'::text,
    secondary_color text DEFAULT '#232323'::text
);


ALTER TABLE public.tenants OWNER TO patrick;

--
-- Name: tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.tenants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tenants_id_seq OWNER TO patrick;

--
-- Name: tenants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;


--
-- Name: trucks; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.trucks (
    id integer NOT NULL,
    tenant_id integer NOT NULL,
    unit_number character varying(50) NOT NULL,
    length_ft integer NOT NULL,
    volume_cf numeric(10,2) NOT NULL,
    mpg numeric(5,2) NOT NULL,
    has_lift_gate boolean DEFAULT false,
    has_ramp boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.trucks OWNER TO patrick;

--
-- Name: trucks_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.trucks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.trucks_id_seq OWNER TO patrick;

--
-- Name: trucks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.trucks_id_seq OWNED BY public.trucks.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.user_roles (
    user_id integer NOT NULL,
    role_id integer NOT NULL
);


ALTER TABLE public.user_roles OWNER TO patrick;

--
-- Name: users; Type: TABLE; Schema: public; Owner: patrick
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    tenant_id integer DEFAULT 1,
    refresh_token character varying(255)
);


ALTER TABLE public.users OWNER TO patrick;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: patrick
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO patrick;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: patrick
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: additional_services id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.additional_services ALTER COLUMN id SET DEFAULT nextval('public.additional_services_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: estimate_additional_services id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimate_additional_services ALTER COLUMN id SET DEFAULT nextval('public.estimate_additional_services_id_seq'::regclass);


--
-- Name: estimate_inventory_items id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimate_inventory_items ALTER COLUMN id SET DEFAULT nextval('public.estimate_inventory_items_id_seq'::regclass);


--
-- Name: estimate_residence_sizes id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimate_residence_sizes ALTER COLUMN id SET DEFAULT nextval('public.estimate_residence_sizes_id_seq'::regclass);


--
-- Name: estimates id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimates ALTER COLUMN id SET DEFAULT nextval('public.estimates_id_seq'::regclass);


--
-- Name: fuel_price_tiers id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.fuel_price_tiers ALTER COLUMN id SET DEFAULT nextval('public.fuel_price_tiers_id_seq'::regclass);


--
-- Name: inventory_items id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.inventory_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_items_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: mover_assignment_rules id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.mover_assignment_rules ALTER COLUMN id SET DEFAULT nextval('public.mover_assignment_rules_id_seq'::regclass);


--
-- Name: mover_teams id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.mover_teams ALTER COLUMN id SET DEFAULT nextval('public.mover_teams_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: residence_sizes id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.residence_sizes ALTER COLUMN id SET DEFAULT nextval('public.residence_sizes_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: tenants id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);


--
-- Name: trucks id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.trucks ALTER COLUMN id SET DEFAULT nextval('public.trucks_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: additional_services; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.additional_services (id, tenant_id, name, description, price, movers_required, created_at, updated_at) FROM stdin;
1	1	Spinet Piano	\N	200.00	2	2025-08-19 10:35:23.451209	2025-08-19 10:35:23.451209
2	1	Upright Piano	\N	250.00	2	2025-08-19 10:35:23.451209	2025-08-19 10:35:23.451209
3	1	Baby Grand Piano	\N	350.00	3	2025-08-19 10:35:23.451209	2025-08-19 10:35:23.451209
4	1	Grand Piano	\N	450.00	3	2025-08-19 10:35:23.451209	2025-08-19 10:35:23.451209
5	1	Concert Grand Piano	\N	650.00	4	2025-08-19 10:35:23.451209	2025-08-19 10:35:23.451209
6	1	Safe 0-200lbs	\N	0.00	2	2025-08-19 10:36:28.531465	2025-08-19 10:36:28.531465
7	1	Safe 200-400lbs	\N	100.00	2	2025-08-19 10:36:28.531465	2025-08-19 10:36:28.531465
8	1	Safe 400-600lbs	\N	150.00	2	2025-08-19 10:36:28.531465	2025-08-19 10:36:28.531465
9	1	Safe 600-800lbs	\N	200.00	3	2025-08-19 10:36:28.531465	2025-08-19 10:36:28.531465
10	1	Safe 800-1000lbs	\N	250.00	3	2025-08-19 10:36:28.531465	2025-08-19 10:36:28.531465
11	1	Safe 1000-1500lbs	\N	300.00	3	2025-08-19 10:36:28.531465	2025-08-19 10:36:28.531465
12	1	Safe 1500lbs+	\N	350.00	3	2025-08-19 10:36:28.531465	2025-08-19 10:36:28.531465
13	1	Grandfather Clock	\N	100.00	2	2025-08-19 10:37:07.875303	2025-08-19 10:37:07.875303
14	1	Overnight Storage	\N	200.00	\N	2025-08-19 10:37:07.875303	2025-08-19 10:37:07.875303
15	1	Additional Truck	\N	200.00	\N	2025-08-19 10:37:07.875303	2025-08-19 10:37:07.875303
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.audit_logs (id, table_name, record_id, column_name, old_value, new_value, changed_at, changed_by) FROM stdin;
1	estimates	3	id	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",600.00,"2025-08-17 21:47:32.159137")	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",650.00,"2025-08-17 21:47:32.159137")	2025-08-17 22:00:48.843	patrick
2	estimates	3	opportunity_id	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",600.00,"2025-08-17 21:47:32.159137")	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",650.00,"2025-08-17 21:47:32.159137")	2025-08-17 22:00:48.843	patrick
3	estimates	3	move_date	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",600.00,"2025-08-17 21:47:32.159137")	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",650.00,"2025-08-17 21:47:32.159137")	2025-08-17 22:00:48.843	patrick
4	estimates	3	move_type	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",600.00,"2025-08-17 21:47:32.159137")	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",650.00,"2025-08-17 21:47:32.159137")	2025-08-17 22:00:48.843	patrick
5	estimates	3	move_service	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",600.00,"2025-08-17 21:47:32.159137")	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",650.00,"2025-08-17 21:47:32.159137")	2025-08-17 22:00:48.843	patrick
6	estimates	3	origin_address	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",600.00,"2025-08-17 21:47:32.159137")	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",650.00,"2025-08-17 21:47:32.159137")	2025-08-17 22:00:48.843	patrick
7	estimates	3	destination_address	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",600.00,"2025-08-17 21:47:32.159137")	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",650.00,"2025-08-17 21:47:32.159137")	2025-08-17 22:00:48.843	patrick
8	estimates	3	origin_stairs	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",600.00,"2025-08-17 21:47:32.159137")	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",650.00,"2025-08-17 21:47:32.159137")	2025-08-17 22:00:48.843	patrick
9	estimates	3	dest_stairs	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",600.00,"2025-08-17 21:47:32.159137")	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",650.00,"2025-08-17 21:47:32.159137")	2025-08-17 22:00:48.843	patrick
10	estimates	3	notes	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",600.00,"2025-08-17 21:47:32.159137")	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",650.00,"2025-08-17 21:47:32.159137")	2025-08-17 22:00:48.843	patrick
11	estimates	3	estimated_cost	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",600.00,"2025-08-17 21:47:32.159137")	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",650.00,"2025-08-17 21:47:32.159137")	2025-08-17 22:00:48.843	patrick
12	estimates	3	created_at	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",600.00,"2025-08-17 21:47:32.159137")	(3,1,"2025-08-21 10:00:00",house,moving,"789 Pine St, NY","101 Maple St, NY",f,t,"Initial quote",650.00,"2025-08-17 21:47:32.159137")	2025-08-17 22:00:48.843	patrick
13	estimates	3	estimated_cost	650.00	700.00	2025-08-17 22:02:49.808628	patrick
14	estimates	3	estimated_cost	700.00	750.00	2025-08-17 22:34:20.096631	patrick
15	estimates	3	notes	Initial quote	Updated quote	2025-08-17 22:34:20.096631	patrick
16	estimates	3	estimated_cost	750.00	800.00	2025-08-17 22:47:26.217575	patrick
17	estimates	3	notes	Updated quote	Test timezone	2025-08-17 22:47:26.217575	patrick
18	customers	1	name	John Doe Updated	John Doe Test	2025-08-17 22:59:16.76108	patrick
19	opportunities	1	notes	Updated request	Test request	2025-08-18 00:58:31.757514	patrick
20	customers	1	email	john.doe.updated@example.com	john.test@example.com	2025-08-18 01:03:14.10469	patrick
21	opportunities	1	move_date	2025-08-20	2025-08-21	2025-08-18 01:03:28.310419	patrick
22	customers	4	deleted	(4,"Test User",test@example.com,555-1234,"Test Corp",t,Web,"2025-08-18 01:11:29.518989")	\N	2025-08-18 01:11:29.521782	patrick
23	customers	5	deleted	(5,"Test User",test@example.com,555-1234,"Test Corp",t,Web,"2025-08-18 01:11:41.948089")	\N	2025-08-18 01:11:41.948089	patrick
24	customers	2	deleted	(2,"Jane Smith",jane.smith@example.com,555-0102,,f,Referral,"2025-08-17 20:43:47.636128")	\N	2025-08-18 01:13:21.66709	patrick
25	opportunities	3	deleted	(3,2,2025-08-22,house,moving,"100 Elm St, NY","200 Pine St, NY",f,t,"2025-08-18 01:13:00.612628","New request")	\N	2025-08-18 01:13:21.66709	patrick
26	opportunities	4	notes	Test move	Updated test move	2025-08-18 02:11:06.108102	patrick
27	opportunities	4	deleted	(4,3,2025-08-19,house,"moving and storage","123 Main St","456 Oak St",t,f,"2025-08-18 02:10:04.596485","Updated test move")	\N	2025-08-18 02:11:52.234407	patrick
28	estimates	5	estimated_cost	500.00	600.00	2025-08-18 02:17:40.463687	patrick
29	estimates	5	notes	Test estimate	Updated test estimate	2025-08-18 02:17:40.463687	patrick
30	estimates	5	deleted	(5,7,"2025-08-19 00:00:00",house,"moving and packing","123 Main St","456 Oak St",t,f,"Updated test estimate",600.00,"2025-08-18 02:16:07.447042")	\N	2025-08-18 02:18:39.156456	patrick
31	estimates	6	estimated_cost	500.00	600.00	2025-08-18 02:29:02.756711	patrick
32	estimates	6	notes	Test estimate	Updated test estimate	2025-08-18 02:29:02.756711	patrick
33	estimates	6	deleted	(6,7,"2025-08-19 00:00:00",house,"moving and packing","123 Main St","456 Oak St",t,f,"Updated test estimate",600.00,"2025-08-18 02:28:09.180998")	\N	2025-08-18 02:30:04.441729	patrick
34	opportunities	8	notes	New tenant move	Updated new tenant move	2025-08-18 02:45:17.158996	patrick
35	opportunities	8	deleted	(8,7,2025-08-20,house,"moving and packing","789 Pine St","101 Elm St",f,t,"2025-08-18 02:44:08.50084","Updated new tenant move")	\N	2025-08-18 02:46:13.497039	patrick
36	estimates	9	estimated_cost	700.00	800.00	2025-08-18 02:50:34.858569	patrick
37	estimates	9	deleted	(9,9,"2025-08-20 00:00:00",house,"moving and packing","789 Pine St","101 Elm St",f,t,"New tenant estimate",800.00,"2025-08-18 02:49:02.294325")	\N	2025-08-18 02:51:26.225387	patrick
38	customers	10	deleted	(10,"Tenant Customer",tenant@example.com,123-456-7890,,,,"2025-08-20 02:46:27.341731",4)	\N	2025-08-20 03:05:58.824094	patrick
39	customers	12	email	test@example.com	updated@example.com	2025-08-20 04:05:09.836103	patrick
40	customers	3	phone	555-0103	+19182929350	2025-08-22 00:11:48.142561	patrick
41	customers	3	email	alice@example.com	getmoving@movethatstuff.com	2025-08-22 13:20:16.477888	patrick
42	customers	6	name	New User	Billy Bob Thornton	2025-08-24 14:23:51.930049	patrick
43	customers	12	deleted	(12,"Valid Test",updated@example.com,,,,,"2025-08-20 04:04:25.458245",1)	\N	2025-08-24 14:24:39.981713	patrick
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.customers (id, name, email, phone, company_name, source, created_at, tenant_id) FROM stdin;
7	Bob Smith	bob@newtenant.com	555-9876	NewTenant Inc	Referral	2025-08-18 02:38:29.819394	2
8	Carol White	carol@secondtenant.com	555-4321	SecondTenant Ltd	Referral	2025-08-18 02:56:26.834783	3
13	John Doe	john@example.com	+1234567890	\N	\N	2025-08-22 04:06:05.618753	1
3	Alice Johnson	getmoving@movethatstuff.com	+19182929350	AJ Corp	Website	2025-08-17 21:47:16.514573	1
14	Test Customer	patricknorris@movethatstuff.com	1234567890	\N	\N	2025-08-23 21:55:21.349673	1
6	Billy Bob Thornton	new@example.com	555-5678	New Corp	Web	2025-08-18 01:13:00.612628	1
15	Bob	bobmills@icloud.com	9182525655	test	Website	2025-08-24 14:27:08.97935	1
16	Mobile Locksmith	admin@tmlocksmith.com	19187708665	Mobile Locksmith	Other	2025-08-24 14:35:55.03558	1
17	Test Two	test2@gmail.com	9182222222	\N	\N	2025-08-25 19:06:24.233755	1
18	Billy Bob Thornton	bt@123.com	5555555555	\N	\N	2025-08-25 19:55:15.750574	1
\.


--
-- Data for Name: estimate_additional_services; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.estimate_additional_services (id, estimate_id, additional_service_id, quantity, price_per_unit, total_price, created_at) FROM stdin;
1	10	1	1	200.00	200.00	2025-08-20 03:36:08.699292
2	10	5	1	650.00	650.00	2025-08-20 03:37:01.585735
\.


--
-- Data for Name: estimate_inventory_items; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.estimate_inventory_items (id, estimate_id, inventory_item_id, quantity, weight_lbs_per_item, volume_cf_per_item, created_at) FROM stdin;
\.


--
-- Data for Name: estimate_residence_sizes; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.estimate_residence_sizes (id, estimate_id, residence_size_id, quantity, weight_lbs_per_unit, created_at) FROM stdin;
1	10	1	1	2000.00	2025-08-19 11:42:43.679801
\.


--
-- Data for Name: estimates; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.estimates (id, customer_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, created_at, notes, status, tenant_id, method, total_weight, total_volume, estimated_hours, labor_cost, truck_cost, fuel_cost, additional_services_cost, total_cost, number_of_movers, distance_miles, number_of_trucks, travel_time, origin_city, origin_state, origin_zip, destination_city, destination_state, destination_zip) FROM stdin;
5	3	2025-08-19	house	moving and packing	123 Main St	456 Oak St	t	f	2025-08-18 02:13:20.889845	Test move recreated	new lead	1	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
6	3	2025-08-19	house	moving and packing	123 Main St	456 Oak St	t	f	2025-08-18 02:13:38.427103	Test move recreated	new lead	1	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7	3	2025-08-19	house	moving and packing	123 Main St	456 Oak St	t	f	2025-08-18 02:15:17.819587	Test move recreated	new lead	1	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9	7	2025-08-20	house	moving and packing	789 Pine St	101 Elm St	f	t	2025-08-18 02:48:11.224852	Recreated new tenant move	new lead	1	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10	3	2025-09-01	house	moving	123 Origin St	456 Dest St	f	\N	2025-08-19 11:39:17.894756	\N	new lead	1	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
12	14	2025-08-25	house	moving	\N	\N	\N	\N	2025-08-23 21:57:45.917161	\N	new lead	1	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
13	3	2025-08-30	house	moving	123 Test St	456 Dest Ave	\N	\N	2025-08-24 03:19:36.399867	\N	new lead	1	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
14	18	2025-09-04	apartment	moving	8720 East 46th Street	3546 E 181st St N Skiatook OK 74070	f	f	2025-08-25 19:55:15.753403	None	new lead	1	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Tulsa	Oklahoma	74070	Skiatook	Oklahoma	74070
\.


--
-- Data for Name: fuel_price_tiers; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.fuel_price_tiers (id, tenant_id, miles_min, miles_max, price_per_gallon, created_at, updated_at) FROM stdin;
1	1	0.00	50.00	2.50	2025-08-19 10:34:50.210682	2025-08-19 10:34:50.210682
2	1	50.00	100.00	2.75	2025-08-19 10:34:50.210682	2025-08-19 10:34:50.210682
3	1	100.00	250.00	3.50	2025-08-19 10:34:50.210682	2025-08-19 10:34:50.210682
4	1	250.00	\N	4.00	2025-08-19 10:34:50.210682	2025-08-19 10:34:50.210682
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.inventory_items (id, tenant_id, name, weight_lbs, volume_cf, created_at, updated_at, description, room) FROM stdin;
1	1	Bar, Portable	105.00	15.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
2	1	Bench, Piano	35.00	5.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
3	1	Bookcase	140.00	20.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
4	1	Bookshelves, Sect.	35.00	5.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
5	1	Cabinet, Curio	70.00	10.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
6	1	Chair, Straight	35.00	5.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
7	1	Chair, Arm	70.00	10.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
8	1	Chair, Rocker	84.00	12.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
9	1	Chair, Occasional	105.00	15.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
10	1	Chair, Overstuffed	175.00	25.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
11	1	Chest, Cedar	105.00	15.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
12	1	Clock, Grandfather	140.00	20.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
13	1	Day Bed	210.00	30.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
14	1	Desk, SM/Winthrop	154.00	22.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
15	1	Desk, Secretary	245.00	35.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
16	1	Fireplace Equip.	35.00	5.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
17	1	Footstool	14.00	2.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
18	1	Hall Tree Rack	14.00	2.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
19	1	Hall Tree Large	84.00	12.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
20	1	Lamp, Floor	21.00	3.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
21	1	Lamp, Pole	21.00	3.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
22	1	Magazine Rack	14.00	2.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
23	1	Music Cabinet	70.00	10.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
24	1	Piano, Baby	490.00	70.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
25	1	Piano, Parlor Gr.	560.00	80.00	2025-08-19 10:47:58.326661	2025-08-19 10:47:58.326661	\N	Living Room
26	1	Piano Spinet/Console	420.00	60.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
27	1	Radio, Table	14.00	2.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
28	1	Rec. Player, Port.	14.00	2.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
29	1	Rugs, Lg. Roll/Pad	70.00	10.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
30	1	Sofa, Rattan/Wicker	21.00	3.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
31	1	Sofa, Sec., Per Sec	70.00	10.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
32	1	Sofa, Loveseat	210.00	30.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
33	1	Sofa, 3 Cushion	245.00	35.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
34	1	Sofa, Hide, 4 Cush.	350.00	50.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
35	1	Stereo Component	420.00	60.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
36	1	Stereo, Console	56.00	8.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
37	1	Tables, Drop leaf	105.00	15.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
38	1	Tables, Occasional	105.00	15.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
39	1	Tables, Coffee	84.00	12.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
40	1	Tables, End	35.00	5.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
41	1	Telephone Stand	35.00	5.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
42	1	TV, Big Screen	280.00	40.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
43	1	TV, Portable	35.00	5.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
44	1	TV, Table Model	70.00	10.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
45	1	TV, Console	105.00	15.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
46	1	TV, Combination	175.00	25.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
47	1	TV, Stand	21.00	3.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
48	1	Trunk	35.00	5.00	2025-08-19 10:50:12.87177	2025-08-19 10:50:12.87177	\N	Living Room
49	1	Bed Inc. Sp/Matt	280.00	40.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
50	1	Bed Rollaway	140.00	20.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
51	1	Bed, Single	280.00	40.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
52	1	Bed, Std/Dbl.	420.00	60.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
53	1	Bed, Queen	455.00	65.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
54	1	Bed, King	490.00	70.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
55	1	Bed, Bunk (Set 2)	490.00	70.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
56	1	Bookshelves, Sect.	35.00	5.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
57	1	Chair, Boudoir	70.00	10.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
58	1	Chair, Rocker	35.00	5.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
59	1	Chaise Lounge	175.00	25.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
60	1	Chest, Bachelor	84.00	12.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
61	1	Chest, Cedar	105.00	15.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
62	1	Chest, Armoire	210.00	30.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
63	1	Desc, SM/Winthrop	154.00	22.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
64	1	Dresser/Vanity Bch	21.00	3.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
65	1	Dresser, Vanity	140.00	20.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
66	1	Dresser, Single	210.00	30.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
67	1	Dresser, Double	280.00	40.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
68	1	Dresser, Triple	350.00	50.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
69	1	Exercise Bike	70.00	10.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
70	1	Lamp, Floor	21.00	3.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
71	1	Night Table	35.00	5.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
72	1	Rug, Large or Pad	70.00	10.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
73	1	Rug, Small or Pad	21.00	3.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
74	1	Wardrobe, Small	140.00	20.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
75	1	Wardrobe, Large	280.00	40.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
76	1	Waterbed	140.00	20.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
77	1	Ironing Board	14.00	2.00	2025-08-19 10:51:40.791888	2025-08-19 10:51:40.791888	\N	Bedroom
78	1	Bassinette	35.00	5.00	2025-08-19 10:52:21.240174	2025-08-19 10:52:21.240174	\N	Nursery
79	1	Bed, Youth	210.00	30.00	2025-08-19 10:52:21.240174	2025-08-19 10:52:21.240174	\N	Nursery
80	1	Chair, Child`s	21.00	3.00	2025-08-19 10:52:21.240174	2025-08-19 10:52:21.240174	\N	Nursery
81	1	Chair, High	35.00	5.00	2025-08-19 10:52:21.240174	2025-08-19 10:52:21.240174	\N	Nursery
82	1	Chest	84.00	12.00	2025-08-19 10:52:21.240174	2025-08-19 10:52:21.240174	\N	Nursery
83	1	Chest, Toy	35.00	5.00	2025-08-19 10:52:21.240174	2025-08-19 10:52:21.240174	\N	Nursery
84	1	Crib, Baby	70.00	10.00	2025-08-19 10:52:21.240174	2025-08-19 10:52:21.240174	\N	Nursery
85	1	Table, Child`s	35.00	5.00	2025-08-19 10:52:21.240174	2025-08-19 10:52:21.240174	\N	Nursery
86	1	Playpen	70.00	10.00	2025-08-19 10:52:21.240174	2025-08-19 10:52:21.240174	\N	Nursery
87	1	Rug, Large or Pad	70.00	10.00	2025-08-19 10:52:21.240174	2025-08-19 10:52:21.240174	\N	Nursery
88	1	Rug, Small or Pad	21.00	3.00	2025-08-19 10:52:21.240174	2025-08-19 10:52:21.240174	\N	Nursery
89	1	Buffer (Base)	210.00	30.00	2025-08-19 10:52:56.771195	2025-08-19 10:52:56.771195	\N	Dining Room
90	1	Hutch (Top)	140.00	20.00	2025-08-19 10:52:56.771195	2025-08-19 10:52:56.771195	\N	Dining Room
91	1	Cabinet, Corner	140.00	20.00	2025-08-19 10:52:56.771195	2025-08-19 10:52:56.771195	\N	Dining Room
92	1	Dining Table	210.00	30.00	2025-08-19 10:52:56.771195	2025-08-19 10:52:56.771195	\N	Dining Room
93	1	Dining Chair	35.00	5.00	2025-08-19 10:52:56.771195	2025-08-19 10:52:56.771195	\N	Dining Room
94	1	Server	105.00	15.00	2025-08-19 10:52:56.771195	2025-08-19 10:52:56.771195	\N	Dining Room
95	1	Tea Cart	70.00	10.00	2025-08-19 10:52:56.771195	2025-08-19 10:52:56.771195	\N	Dining Room
96	1	Rugs, Large or Pad	70.00	10.00	2025-08-19 10:52:56.771195	2025-08-19 10:52:56.771195	\N	Dining Room
97	1	Rugs, Small or Pad	21.00	3.00	2025-08-19 10:52:56.771195	2025-08-19 10:52:56.771195	\N	Dining Room
98	1	Kitchen Chairs	35.00	5.00	2025-08-19 10:53:33.88928	2025-08-19 10:53:33.88928	\N	Kitchen
99	1	Kitchen Table	70.00	10.00	2025-08-19 10:53:33.88928	2025-08-19 10:53:33.88928	\N	Kitchen
100	1	Chair, High	35.00	5.00	2025-08-19 10:53:33.88928	2025-08-19 10:53:33.88928	\N	Kitchen
101	1	Kitchen Cabinet	210.00	30.00	2025-08-19 10:53:33.88928	2025-08-19 10:53:33.88928	\N	Kitchen
102	1	Microwave Oven	70.00	10.00	2025-08-19 10:53:33.88928	2025-08-19 10:53:33.88928	\N	Kitchen
103	1	Serving Cart	105.00	15.00	2025-08-19 10:53:33.88928	2025-08-19 10:53:33.88928	\N	Kitchen
104	1	Stool	21.00	3.00	2025-08-19 10:53:33.88928	2025-08-19 10:53:33.88928	\N	Kitchen
105	1	Utility Cabinet	70.00	10.00	2025-08-19 10:53:33.88928	2025-08-19 10:53:33.88928	\N	Kitchen
106	1	Air Cond./Wind. Sm.	105.00	15.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
107	1	Air Cond./Wind. Lg.	140.00	20.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
108	1	Dehumidifier	70.00	10.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
109	1	Dishwasher	140.00	20.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
110	1	Freezer 10 or less	210.00	30.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
111	1	Freezer 11 to 15	315.00	45.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
112	1	Freezer 16 or over	420.00	60.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
113	1	Range 20' Wide	70.00	10.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
114	1	Range 30' Wide	105.00	15.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
115	1	Range 36' Wide	210.00	30.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
116	1	Ref. 6 cu. ft. or less	210.00	30.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
117	1	Ref. 7 to 10 cu. ft.	315.00	45.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
118	1	Ref. 11 cu. ft./over	420.00	60.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
119	1	Trash Compactor	105.00	15.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
120	1	Vacuum Cleaner	35.00	5.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
121	1	Washing Machine	175.00	25.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
122	1	Dryer	175.00	25.00	2025-08-19 10:54:01.656668	2025-08-19 10:54:01.656668	\N	Appliances
123	1	BBQ Grill, Camping	14.00	2.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
124	1	BBQ Grill, Large	70.00	10.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
125	1	Chairs, Aluminum	7.00	1.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
126	1	Chairs, Metal	21.00	3.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
127	1	Chairs, Wood	35.00	5.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
128	1	Garden Hose & Tools	70.00	10.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
129	1	Glider or Settee	140.00	20.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
130	1	Ladder, 6' Step	21.00	3.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
131	1	Ladder, 8' Metal	14.00	2.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
132	1	Ladder, Extension	56.00	8.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
133	1	Lawn Mower, Hand	35.00	5.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
134	1	Lawn Mower, Power	105.00	15.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
135	1	Lawn Mower, Riding	245.00	35.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
136	1	Lawn Edger	21.00	3.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
137	1	Leaf Sweeper	35.00	5.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
138	1	Outdoor Child Slide	70.00	10.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
139	1	Outdoor Child Gym	140.00	20.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
140	1	Outdoor Dry, Racks	35.00	5.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
141	1	Outdoor Swings	210.00	30.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
142	1	Picnic Table	140.00	20.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
143	1	Picnic Bench	35.00	5.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
144	1	Roller, Lawn	105.00	15.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
145	1	Rug, Large	49.00	7.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
146	1	Rug, Small	21.00	3.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
147	1	Sand Box	70.00	10.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
148	1	Spreader	14.00	2.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
149	1	Table, Small	14.00	2.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
150	1	Table, Large	28.00	4.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
151	1	Umbrella	35.00	5.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
152	1	Wheelbarrow	56.00	8.00	2025-08-19 10:57:38.972983	2025-08-19 10:57:38.972983	\N	Patio & Outdoor
153	1	Baby Carriage	28.00	4.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
154	1	Barbells	35.00	5.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
155	1	Basket (Clothes)	35.00	5.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
156	1	Bicycle	35.00	5.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
157	1	Tricycle	14.00	2.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
158	1	Bowling Ball/Bag	21.00	3.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
159	1	Card Table	14.00	2.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
160	1	Folding Chairs	7.00	1.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
161	1	Clothes Hamper	35.00	5.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
162	1	Cot, Folding	70.00	10.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
163	1	Desk, Office	70.00	10.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
164	1	Fan	35.00	5.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
165	1	Fem/Plant Stands	14.00	2.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
166	1	File Cabinet 2 Drawer	70.00	10.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
167	1	File Cabinet 4 Drawer	140.00	20.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
168	1	Footlockers	35.00	5.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
169	1	Game Table	105.00	15.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
170	1	Golf Bag	28.00	4.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
171	1	Heater, Gas/Electric	35.00	5.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
172	1	Metal Shelves	35.00	5.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
173	1	Personal Computer	28.00	4.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
174	1	Monitor	28.00	4.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
175	1	Printer	21.00	3.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
176	1	Ping Pong Table	280.00	40.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
177	1	Pool Table Comp.	280.00	40.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
178	1	Pool Table Slate	70.00	10.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
179	1	Power Tool Hand Ea	21.00	3.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
180	1	Power Tool Stand	105.00	15.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
181	1	Sewing Machine, Port	70.00	10.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
182	1	Sewing Machine	140.00	20.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
183	1	Sled	14.00	2.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
184	1	Suitcase	35.00	5.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
185	1	Table, Utility	35.00	5.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
186	1	Tackle Box	7.00	1.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
187	1	Tire	21.00	3.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
188	1	Tire w/Rim	35.00	5.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
189	1	Tool Chest, Small	35.00	5.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
190	1	Tool Chest, Medium	70.00	10.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
191	1	Tool Chest, Large	105.00	15.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
192	1	Trash Can	49.00	7.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
193	1	Wagon, Child`s	35.00	5.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
194	1	Wastepaper Basket	14.00	2.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
195	1	Work Bench	140.00	20.00	2025-08-19 10:58:39.32205	2025-08-19 10:58:39.32205	\N	Misc.
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.messages (id, sender_type, channel, content, "timestamp", is_read, tenant_id, tracking_id, read_at, opportunity_id) FROM stdin;
1	agent	sms	Your MoveThatStuff estimate is ready: https://crm.movethatstuff.com/portal/estimates/10?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlc3RpbWF0ZV9pZCI6MTAsInR5cGUiOiJjdXN0b21lcl92aWV3IiwiaWF0IjoxNzU1ODE3OTc4LCJleHAiOjE3NTU5MDQzNzh9.aXYQZxaNufidXQbklj6DM6hVPBoN5cmzeDXfugcAOf8. Reply STOP to opt-out.	2025-08-22 00:12:58.742831+01	f	1	\N	\N	\N
2	agent	sms	Your MoveThatStuff estimate is ready: https://crm.movethatstuff.com/portal/estimates/10?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlc3RpbWF0ZV9pZCI6MTAsInR5cGUiOiJjdXN0b21lcl92aWV3IiwiaWF0IjoxNzU1ODE5MjQ5LCJleHAiOjE3NTU5MDU2NDl9.euYK5pAVDmvOVaJFozwW-RIKIKYbSfQkf93XY6f3g3c. Reply STOP to opt-out.	2025-08-22 00:34:10.247961+01	f	1	\N	\N	\N
3	agent	sms	Your MoveThatStuff estimate is ready: https://crm.movethatstuff.com/portal/estimates/10?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlc3RpbWF0ZV9pZCI6MTAsInR5cGUiOiJjdXN0b21lcl92aWV3IiwiaWF0IjoxNzU1ODIwMjg3LCJleHAiOjE3NTU5MDY2ODd9.oSpHHKJrYFW3LULl7S7x_GMUlkbwD0PR1nr0YOkjAqk. Reply STOP to opt-out.	2025-08-22 00:51:27.566526+01	f	1	\N	\N	\N
4	agent	email	A new opportunity for your move on 2025-08-29 has been created. View details: https://crm.movethatstuff.com/portal/opportunities/13?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcHBvcnR1bml0eV9pZCI6MTMsInR5cGUiOiJjdXN0b21lcl92aWV3IiwiaWF0IjoxNzU2MDAxOTc2LCJleHAiOjE3NTYwODgzNzZ9.ZSJypCg8XLwn7CYG19MJFyCAuaz1ogs791vi0WWwmi8	2025-08-24 03:19:36.415744+01	f	1	\N	\N	13
5	agent	email	A new estimate for your move on Invalid date has been created. View details: https://crm.movethatstuff.com/portal/estimates/17?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlc3RpbWF0ZV9pZCI6MTcsInR5cGUiOiJjdXN0b21lcl92aWV3IiwiaWF0IjoxNzU2MDAyMDU1LCJleHAiOjE3NTYwODg0NTV9.RXeplFCJERMxfBsonorZGFKcGBKBqOYZQkNQiXkdFUM	2025-08-24 03:20:55.108775+01	t	1	\N	2025-08-24 02:25:03	\N
\.


--
-- Data for Name: mover_assignment_rules; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.mover_assignment_rules (id, tenant_id, hours_min, hours_max, number_of_movers, created_at, updated_at) FROM stdin;
1	1	0.00	6.00	2	2025-08-19 10:32:51.305336	2025-08-19 10:32:51.305336
2	1	6.00	8.00	3	2025-08-19 10:32:51.305336	2025-08-19 10:32:51.305336
3	1	8.00	10.00	4	2025-08-19 10:32:51.305336	2025-08-19 10:32:51.305336
4	1	10.00	12.00	5	2025-08-19 10:33:27.26607	2025-08-19 10:33:27.26607
5	1	12.00	14.00	6	2025-08-19 10:33:27.26607	2025-08-19 10:33:27.26607
6	1	14.00	16.00	7	2025-08-19 10:33:27.26607	2025-08-19 10:33:27.26607
7	1	16.00	18.00	8	2025-08-19 10:33:27.26607	2025-08-19 10:33:27.26607
\.


--
-- Data for Name: mover_teams; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.mover_teams (id, tenant_id, number_of_movers, lbs_per_hour, price_per_hour, created_at, updated_at) FROM stdin;
1	1	2	900.00	140.00	2025-08-19 10:30:53.96187	2025-08-19 10:30:53.96187
2	1	3	1350.00	210.00	2025-08-19 10:30:53.96187	2025-08-19 10:30:53.96187
3	1	4	1800.00	280.00	2025-08-19 10:30:53.96187	2025-08-19 10:30:53.96187
4	1	5	2250.00	350.00	2025-08-19 10:30:53.96187	2025-08-19 10:30:53.96187
5	1	6	2700.00	420.00	2025-08-19 10:32:11.274278	2025-08-19 10:32:11.274278
6	1	7	3150.00	590.00	2025-08-19 10:32:11.274278	2025-08-19 10:32:11.274278
7	1	8	3600.00	660.00	2025-08-19 10:32:11.274278	2025-08-19 10:32:11.274278
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.permissions (id, name, description, created_at, updated_at) FROM stdin;
1	manage_tenants	Create/update/delete tenants (SaaS admin only)	2025-08-20 11:12:56.508919	2025-08-20 11:12:56.508919
2	manage_roles	Create/update/delete roles and permissions (future endpoints)	2025-08-20 11:12:56.508919	2025-08-20 11:12:56.508919
3	view_settings	Read tenant-specific settings like mover_teams, trucks	2025-08-20 11:12:56.508919	2025-08-20 11:12:56.508919
4	edit_settings	Create/update/delete tenant-specific settings	2025-08-20 11:12:56.508919	2025-08-20 11:12:56.508919
5	view_customers	Read customers	2025-08-20 11:12:56.508919	2025-08-20 11:12:56.508919
6	edit_customers	Create/update/delete customers	2025-08-20 11:12:56.508919	2025-08-20 11:12:56.508919
9	view_estimates	Read estimates	2025-08-20 11:12:56.508919	2025-08-20 11:12:56.508919
10	edit_estimates	Create/update/delete estimates, including calculations	2025-08-20 11:12:56.508919	2025-08-20 11:12:56.508919
11	view_reports	View reporting endpoints like estimate summaries	2025-08-21 22:52:00.894732	2025-08-21 22:52:00.894732
12	view_messages	View messages and notifications	2025-08-22 00:17:12.930765	2025-08-22 00:17:12.930765
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.refresh_tokens (id, user_id, token, created_at, expires_at) FROM stdin;
1	1	5b3ba7f010280d8f4142a7370f5e24afe5bddb4fc2c7ce57375aa09c04ab952a60362d9ea19c256a80e61fa425d3dabc72ee4c17fd9a0e72f61c193013449670	2025-08-20 12:02:00.716487	2025-08-27 12:02:00.716487
2	1	497a572e8576a64cb65c30885ae1c8ad690a3a1145ee3d00db69f6ca36cc17d8bb1ad10a06a62dc73e405e0aaa24f47253e097dd4f820be3d6f69dae7e357235	2025-08-20 13:22:34.634963	2025-08-27 13:22:34.634963
3	1	e9c57f3badb05efd41767eeef2845927cd77a9527584af66d5c08b4f8dc0c67cbd853488946e62c8f3dcf98e5c1fcd126553cf37127459bd00000b75acec6e02	2025-08-21 22:54:31.290042	2025-08-28 22:54:31.290042
4	1	f75dece84f4b8ecc9ca61b54c18f00cc119f5d216a96b3a06b81d78bfed9faf2eabcbda5d49f01bf2714a42e6463406be2a2d615d8f342a0e2ec167cb8c8cee3	2025-08-22 00:07:10.5962	2025-08-29 00:07:10.5962
5	1	c596bcacdf75ea24b80227bab1b4cbb27cf00dc8e05181349949d6c98834e80153c985348782ff5c162bfe4fc478efce606c6901d18c96b2ff2d56a6d5dc5c41	2025-08-22 00:12:19.256247	2025-08-29 00:12:19.256247
6	1	f9d805776df6ce0424a2f99e35fd6352b19fecb45a4f42a80aa0ca31b617b2907794f40eb33bf21ad00860a6126d771307c580bfd59d90cdf95347f7e2ddb6a5	2025-08-22 00:31:15.060418	2025-08-29 00:31:15.060418
7	1	48d1998e6e65e57b773cd0a026b8cd5007fdf5242048c91a488f150c83ef3eae886810a46fe6e0add7b699d339881611d7ead945fd778a44630990e576a484c1	2025-08-22 00:33:54.084788	2025-08-29 00:33:54.084788
8	14	43e81891885112a869332b6c6781129975f8ceed5124c88ea351fa7654a6232a04012da79b58f61643a5033dab022dc00415aa5554bfc5471540df06d2d5b6ab	2025-08-22 03:57:20.78638	2025-08-29 03:57:20.78638
9	15	6115091754d1fba6818611a89d3025d5e6f5853feec26fa8bb65eac294769063a1074d40b1218622119616533abfdb36e5be5a0fbff00ef5095fb8d8b1bdd1d4	2025-08-22 03:59:33.195756	2025-08-29 03:59:33.195756
10	15	61fad0ce28eea09963b24bb120150a3f064d7c001fac5aefcaee8f2fb92c956f54df5f394a622627ed6924ee59355c6fdaa054fae564da69d7ac67cfeaa22294	2025-08-22 04:01:31.369393	2025-08-29 04:01:31.369393
11	15	b971319a9a69d94f70e9a9eba6f435e845a3db3afd1d9224e1a491d8233ab35b91741531fbd7ef7efbaba500ae50a4aa4e77ab5bf0bab75530116d00efa1e23a	2025-08-22 04:03:52.400284	2025-08-29 04:03:52.400284
12	1	6673bd00816b1ff9ecad6cefed00ea1abf290da0841f3f31a9401108fcf2b84d6a83d9185e9b08f404b4b7ac09fe8efccee2db3e856b81bb2742693a5c9bbf89	2025-08-22 12:23:38.754994	2025-08-29 12:23:38.754994
13	1	59f9e11074ca965a2e44325dbc336e1628ba8cc1d9f8ec25bc9c97bfb35fd7cf37ced126de048f530a3ee194d0d9b887c8976a4812fe1cf402efccb8dafa9b29	2025-08-22 12:27:43.08777	2025-08-29 12:27:43.08777
14	1	e1e5292a6dceb5226a570c6114bd4e666bf9b0fa30675a7b5bea8f6c673a7dad27c254d81ca257ffa2bc7ab75c62e766dde9b82a6a438faeff6449ebb12a5bc7	2025-08-22 12:30:54.351676	2025-08-29 12:30:54.351676
15	1	c13f98977e2864d5125b57eff47cf53a45cdd5454507ba95b8059a5dcf927a74d0c0dc08aac8eb3a8c45d83da0ea3517d49eace05a7ef6dcef9e30cd1e49811c	2025-08-22 13:15:31.613735	2025-08-29 13:15:31.613735
16	1	1322e16a3f1cddce5209d2e1780d11d779b7b389ee526551820bc0f3c21af551a5ea2b0be2c2873e28da776ffebbe1ee7b20f6a5832fedaf09e9d5af178ebed8	2025-08-23 21:48:05.365971	2025-08-30 21:48:05.365971
17	1	5564421d8bb84200343782a66634e8eed5f1312fabfdc40e9bd55d006c599764f910341c4896ff2ac2271edd2b6c68d5baa7de861aea5a477920c52528027c92	2025-08-23 21:53:30.25927	2025-08-30 21:53:30.25927
18	1	c4784fec6f7b1229598d78162238365c4f97201bd51c731c3601753d66081496bff4e4c86c28099c4835508205a62d55f0494601953262318d40b07ed080e150	2025-08-23 21:57:20.029318	2025-08-30 21:57:20.029318
19	1	a5610b5c29a27498c85ab9cadee04fec137b327b7100ac701048bec8d3d29da3471fc864b701bab1eaa9fc6a3f5bea2ec5c732ede4448b3a5f6ee885da0a78a1	2025-08-24 02:16:17.937798	2025-08-31 02:16:17.937798
20	1	93d470f6a8e2a2ab73a1887b17da0ec3389a71db717a02400bf5356de54af1cbe17f4bbb9437517c291d787ac7d7d8bd91768e24819f900a9ee8d4574047cbe9	2025-08-24 03:18:35.003366	2025-08-31 03:18:35.003366
21	1	a84aba978188a7497cc1d428cb6d0c3d916c36a532c9ebc14c3594238c605a56cd12f3fdd11974f8d7b40d69183f7c3b9d37093c66ebbb55778c0b0566ee2845	2025-08-24 04:19:49.888378	2025-08-31 04:19:49.888378
22	1	fe1bd3f8f817834a513de990d094c939626a7a846d7652808ed97c3cbe2e306b16904bd399018f4161f38dcf38998a063f163c472c4a66d302fdf578f23e8947	2025-08-24 04:20:23.727772	2025-08-31 04:20:23.727772
23	1	c1b3f9d8aafdb504dba311e77879642cc47a0db255ccf20094a483d2f9539b87731f5f562a6cb71764bd9e089b6986db3a6b47ed4a6037c5b0d6ac433158ae64	2025-08-24 04:30:05.916034	2025-08-31 04:30:05.916034
24	1	92d14cc430e72e0c61a9a57fc5821d10106879ec728a1a12d7d5e4dace6c473746048cd8258fe0e250b5f3256524241825de40058fee2dd2325dd7a679dc25d9	2025-08-24 04:31:17.946095	2025-08-31 04:31:17.946095
25	1	11567519297a25d5657eead5fff3c800fafc78515531e8842d2624d2a59df433cb42895fd4a9d0ab5f91f908f8b68a4a21155e6d1cb860ef24b382f77b0362cc	2025-08-24 04:49:51.660224	2025-08-31 04:49:51.660224
26	1	a3fd463b347df9a1df77f8122066036c6bd9405fbe2bd19933cd9699df092a380bc6e2e315d66d7dc27e070e372fff54c8509b37f1a41e335dd6caa34f2edca6	2025-08-24 04:51:05.184123	2025-08-31 04:51:05.184123
27	1	451313a7fa788979affc4dcecc0d03d87042523e6ddb50562c917215b31ab8444c38b854bfbd4df1ddcb93ee7352fc52536d3fa9e3912d34e6077045eb53702a	2025-08-24 14:23:24.501312	2025-08-31 14:23:24.501312
28	1	c5ed7707d78eba4f1fbf2620361a3d35ad8c08f06271a448883c7811aa0cd74e2cd28fcff65053904d0e5e599ec9ed22f5111b15ad3a87ac6c60c86f532deded	2025-08-24 15:24:04.970282	2025-08-31 15:24:04.970282
29	1	7a43e82beacb34d1acf2f5792d174f026f1b0144733b5f25653ce53037bafe6a10af29cd5263bc3a842cbbcb0ae7c62b47eeaab7273f75e66008c6e00cf22eb8	2025-08-24 15:31:32.07658	2025-08-31 15:31:32.07658
30	1	3c6e3b10729046874f0d8f63d42d0328c3046bfae4ae5a3281e46efefb27e3f05d66acdad60914870a05c501c065fa5a455927c1cb58146edd8fc371b6779195	2025-08-24 15:58:33.453694	2025-08-31 15:58:33.453694
31	1	fceb14165d6b804dec8e2ac25f77299514e394c9afe2e0feca63e969ab31faf63ac323e2de5c42dc0e514c7e6fcdc253b44dc520d288df984d84f3ad2c916810	2025-08-24 16:31:47.073859	2025-08-31 16:31:47.073859
32	1	6f959160274dffa65483c83de488c98422ac5d4ddbebed973bbd462c96c85627e5ff7243196ee1c61068fc34bf0b2e1f07c6916bfa493959e60bd6716574643d	2025-08-24 18:44:45.558158	2025-08-31 18:44:45.558158
33	1	cc3ddd3dce56783380cc3ed569ec0e104210c3f84b754d86bb34fadb9c936846234db8087bfa3b097ef7e53bb6e5dae371ad53c40ad97e72a28bf8e199f234df	2025-08-24 19:45:55.319143	2025-08-31 19:45:55.319143
34	1	561cfc9eb93962cb530ce3f466a83837fd3c71389ed0c39b3bb914001be0bdc28982920d9674ed8690db98f09feabd33eeea91dc56679296e0dffef4445c2ce9	2025-08-25 11:08:50.763666	2025-09-01 11:08:50.763666
35	1	db0e0db1ed585eb5d0c2919ab39ed03dc2c7a075d5d2f0f26422bdf7362d2d6cedda81b535434c39d7b5bd5957496adcc4f5096b4fb628f77bbf0889763b02b4	2025-08-25 18:58:08.279689	2025-09-01 18:58:08.279689
36	1	0dc549b59ba7611509d4d3f5245ca44eb860ff9f31aeb4d6e08a7908914fcbd6aeacabb29de113e1873ba94ec6cd420f13d929a56805120211b755f873bb732c	2025-08-25 19:01:10.0916	2025-09-01 19:01:10.0916
37	1	cd9dcf5513bfc9469fd22ad22bac606e5bc25f7cc7180f41ed675e8384573552bb33b0ab104362040511d4d944d025f014711a4c7bfe41cb60388deab8c263d7	2025-08-25 19:54:04.872243	2025-09-01 19:54:04.872243
38	1	6565e563afc78e999c292b9d224608ee8ac30107a5dca94f5c02b4fe92b500445e440585a677650b77038159cb44d6b817ef26e0e8d52349254ee3d07d05fadd	2025-08-25 20:40:39.711743	2025-09-01 20:40:39.711743
39	1	05ee25248af30eb4284b65a70fd98d238c380d27e11642c6ce4d95e3b7fde0bfad43408517edcb37d3939d4e481025b4f4c844fa4dc10cb51d5e8b518ba936bc	2025-08-25 20:40:52.810086	2025-09-01 20:40:52.810086
40	1	de287009dc94a834c4cbf1978f62f92e48f7dc36fdd77c4085ffc98d556dd401cd12400cd3f8d2b646273600df98494360539f871f880ced30601d2bfd558ee9	2025-08-25 20:45:39.295892	2025-09-01 20:45:39.295892
41	1	5d1dbdbc1cfde5bf9f4e99b72c4749ba245ca7c6f0b0d66eb8f8a4bcb441b0019eb371e5c4f6c2866c7b3a53d7ef05d2542331058318efc0fb805631b8eb1362	2025-08-25 20:56:06.555483	2025-09-01 20:56:06.555483
42	1	e490f5fc165eb35245732227e6e00107af216a2b235ae01f9d25555733cf1313c574dfe8d91d97074a9e9d4c27016fcd93dc3f6fda8032829b49e91e29963024	2025-08-25 20:56:15.586925	2025-09-01 20:56:15.586925
43	1	ca4f0eada1e503e0ff9ffaba8ae9a7a76844522ae5f46fa287f7678ddcfa61e13c5fc68289a204ba4eb4500cd877805ab309928465539a0934124ac4ce8efd26	2025-08-25 21:07:11.825295	2025-09-01 21:07:11.825295
44	1	a64720b6b35cdff001203ebbb6649bd6d05c9883c9b05df59a99855c247a95ce148a7571375bb8fc2fd3d435e8779a1926656cafc9083a64eecd4909897fe34a	2025-08-25 21:30:42.284732	2025-09-01 21:30:42.284732
45	1	ba16471eee02426dff682c5aa09e1613e9626789bfd7f34bdbb51850f6dbe918ad977e30dd13866d259d13d222ef405e6096f5315f2565ecdf58ee6d927890de	2025-08-25 21:36:53.092689	2025-09-01 21:36:53.092689
46	1	8e853677a2f5c93406bbfd28d1beff9aeed69e75e37455fa20a53e5e77a09657c29cca55243d7fe9bfd9a3ff561ef0056bc10279ca359fb7b0c8e0f878802086	2025-08-25 21:49:59.676337	2025-09-01 21:49:59.676337
\.


--
-- Data for Name: residence_sizes; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.residence_sizes (id, tenant_id, type, size_description, weight_lbs, created_at, updated_at) FROM stdin;
1	1	apartment	Studio Apt	2000.00	2025-08-19 10:26:48.336071	2025-08-19 10:26:48.336071
2	1	apartment	1 Bed Apt	2500.00	2025-08-19 10:26:48.336071	2025-08-19 10:26:48.336071
3	1	apartment	2 Bed Apt	3500.00	2025-08-19 10:26:48.336071	2025-08-19 10:26:48.336071
4	1	apartment	3 Bed Apt	4500.00	2025-08-19 10:26:48.336071	2025-08-19 10:26:48.336071
5	1	house_bedrooms	2 Bed House	6500.00	2025-08-19 10:26:55.427054	2025-08-19 10:26:55.427054
6	1	house_bedrooms	3 Bed House	8500.00	2025-08-19 10:26:55.427054	2025-08-19 10:26:55.427054
7	1	house_bedrooms	4 Bed House	10500.00	2025-08-19 10:26:55.427054	2025-08-19 10:26:55.427054
8	1	house_bedrooms	5+ Bed House	14500.00	2025-08-19 10:26:55.427054	2025-08-19 10:26:55.427054
9	1	house_sqft	1200-1400sqft	6500.00	2025-08-19 10:27:58.488852	2025-08-19 10:27:58.488852
10	1	house_sqft	1400-1600sqft	7500.00	2025-08-19 10:27:58.488852	2025-08-19 10:27:58.488852
11	1	house_sqft	1600-1800sqft	8500.00	2025-08-19 10:27:58.488852	2025-08-19 10:27:58.488852
12	1	house_sqft	1800-2000sqft	9500.00	2025-08-19 10:27:58.488852	2025-08-19 10:27:58.488852
13	1	house_sqft	2000-2200sqft	10500.00	2025-08-19 10:27:58.488852	2025-08-19 10:27:58.488852
14	1	house_sqft	2200-2400sqft	12500.00	2025-08-19 10:28:26.568308	2025-08-19 10:28:26.568308
15	1	house_sqft	2400-2600sqft	14500.00	2025-08-19 10:28:26.568308	2025-08-19 10:28:26.568308
16	1	house_sqft	2600-2800sqft	16500.00	2025-08-19 10:28:26.568308	2025-08-19 10:28:26.568308
17	1	house_sqft	2800-3000sqft	18500.00	2025-08-19 10:28:26.568308	2025-08-19 10:28:26.568308
18	1	house_sqft	3000-3500sqft	20500.00	2025-08-19 10:28:26.568308	2025-08-19 10:28:26.568308
19	1	house_sqft	3500-4000sqft	22500.00	2025-08-19 10:29:01.448344	2025-08-19 10:29:01.448344
20	1	house_sqft	4000+sqft	24500.00	2025-08-19 10:29:01.448344	2025-08-19 10:29:01.448344
21	1	storage	5x5	2125.00	2025-08-19 10:30:14.978278	2025-08-19 10:30:14.978278
22	1	storage	5x10	3188.00	2025-08-19 10:30:14.978278	2025-08-19 10:30:14.978278
23	1	storage	10x10	4250.00	2025-08-19 10:30:14.978278	2025-08-19 10:30:14.978278
24	1	storage	10x15	6125.00	2025-08-19 10:30:14.978278	2025-08-19 10:30:14.978278
25	1	storage	10x20	8500.00	2025-08-19 10:30:18.873065	2025-08-19 10:30:18.873065
26	1	storage	10x30	12750.00	2025-08-19 10:30:18.873065	2025-08-19 10:30:18.873065
27	1	storage	10x40	17000.00	2025-08-19 10:30:18.873065	2025-08-19 10:30:18.873065
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.role_permissions (role_id, permission_id) FROM stdin;
1	1
1	2
1	3
1	4
1	5
1	6
1	9
1	10
2	3
2	4
2	5
2	6
2	9
2	10
3	3
3	5
3	6
3	9
3	10
4	9
5	9
1	11
1	12
2	12
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.roles (id, name, description, created_at, updated_at) FROM stdin;
1	admin	Full system access, including tenant and role management	2025-08-20 11:12:56.505782	2025-08-20 11:12:56.505782
2	manager	Can edit settings, customers, opportunities, estimates	2025-08-20 11:12:56.505782	2025-08-20 11:12:56.505782
3	customer_service_agent	View/edit customers, opportunities, estimates	2025-08-20 11:12:56.505782	2025-08-20 11:12:56.505782
4	driver	View-only for assigned opportunities/estimates	2025-08-20 11:12:56.505782	2025-08-20 11:12:56.505782
5	helper	Limited view-only access	2025-08-20 11:12:56.505782	2025-08-20 11:12:56.505782
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.tenants (id, name, created_at, phone_number, email, logo_url, address, timezone, google_maps_api_key, enable_communications, primary_color, secondary_color) FROM stdin;
2	NewTenant	2025-08-18 01:31:34.10593	\N	\N	\N	\N	America/New_York	\N	f	#ff4f00	#232323
3	SecondTenant	2025-08-18 01:52:12.404488	\N	\N	\N	\N	America/Los_Angeles	\N	f	#ff4f00	#232323
1	MoveThatStuff Default	2025-08-18 00:46:47.839993	918-292-9350	getmoving@movethatstuff.com	\N	1566 N 166th E Ave, Tulsa OK 74116	America/New_York	AIzaSyCIEZbjaw7Dn6pfOG2UT3mBIwLuhzYJt8Y	t	#ff4f00	#232323
\.


--
-- Data for Name: trucks; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.trucks (id, tenant_id, unit_number, length_ft, volume_cf, mpg, has_lift_gate, has_ramp, created_at, updated_at) FROM stdin;
1	1	001	26	1250.00	8.00	f	f	2025-08-19 10:33:55.050298	2025-08-19 10:33:55.050298
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.user_roles (user_id, role_id) FROM stdin;
1	1
5	2
2	2
6	2
4	2
8	4
11	2
12	2
14	2
15	2
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: patrick
--

COPY public.users (id, username, password, created_at, tenant_id, refresh_token) FROM stdin;
4	testuser	$2b$10$F1tnsQ8JBt4QASqnkgHdoO9fJKHUG0C1BI8eOq6u/RjkweqXTtacm	2025-08-18 02:41:43.090457+01	2	\N
6	testnewuser	$2b$10$Fk8fFq1DMB12k3JW64gz2.1sFpWr.vWdtpZKzcDisQntK6M0.iAqi	2025-08-18 11:42:56.058705+01	2	\N
2	newuser	$2b$10$ZkBtE4JfHudUDKSJtC4OyOhPsWJTLsbAVhRGPyQEZ0hJtpLF8trji	2025-08-18 02:32:20.407162+01	2	\N
5	seconduser	$2b$10$/QuXLoraHEnwGqZ1HrtjxOOW8R0Y2G4cSba67ZJHFfdosdoFzB9QW	2025-08-18 02:53:53.430484+01	3	\N
1	admin	$2b$10$oneoq6VIFDOlY31D2dtLF.6wru2MG3Cxm/9dYXsHoyoRJRpLHTS9O	2025-08-18 01:39:55.174161+01	1	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzU1Njg1Njc5LCJleHAiOjE3NTYyOTA0Nzl9.IQmShvDrw3ADdOOUStFQ5xJruGIowtijUvXlzewg6Gw
8	testdriver	$2b$10$LDMl4hdmoPTKN13eig2FOe8X9b9wA9kW5u2pbW4aGDJhzTsEkHn/y	2025-08-20 11:25:51.407445+01	1	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OCwiaWF0IjoxNzU1Njg1Nzk1LCJleHAiOjE3NTYyOTA1OTV9.Omcytgi7--m5U9eomk6Ogkbqk6ka4vZ5QuCoi3RYFTw
11	admin1	$2b$10$XqjceC/wj70sFz/RjAvvp./DhRpwh.W47InLD1T7yqYwciEB1rA5W	2025-08-22 03:50:09.065117+01	1	\N
12	admin2	$2b$10$QTVoFKf/cDibWllvDt.FW.P8b79Ndc30hjiiKPs63rZTTHNyeS.ea	2025-08-22 03:53:14.970285+01	1	\N
14	grokuser1	$2b$10$2teo00ongY2xllm7zUjxQuBe/5tvIB8PSO1GJVaZoUQ/R2BRtsUui	2025-08-22 03:57:11.787871+01	1	\N
15	grokuser2	$2b$10$m.KOzoa125Qi.wFIleGQbuFUkqbigneWODIa2LhD78lSWwfvGIj3e	2025-08-22 03:59:25.154494+01	1	\N
\.


--
-- Name: additional_services_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.additional_services_id_seq', 15, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 43, true);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.customers_id_seq', 18, true);


--
-- Name: estimate_additional_services_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.estimate_additional_services_id_seq', 2, true);


--
-- Name: estimate_inventory_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.estimate_inventory_items_id_seq', 1, false);


--
-- Name: estimate_residence_sizes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.estimate_residence_sizes_id_seq', 1, true);


--
-- Name: estimates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.estimates_id_seq', 14, true);


--
-- Name: fuel_price_tiers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.fuel_price_tiers_id_seq', 4, true);


--
-- Name: inventory_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.inventory_items_id_seq', 195, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.messages_id_seq', 5, true);


--
-- Name: mover_assignment_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.mover_assignment_rules_id_seq', 7, true);


--
-- Name: mover_teams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.mover_teams_id_seq', 7, true);


--
-- Name: permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.permissions_id_seq', 12, true);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.refresh_tokens_id_seq', 46, true);


--
-- Name: residence_sizes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.residence_sizes_id_seq', 27, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.roles_id_seq', 5, true);


--
-- Name: tenants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.tenants_id_seq', 4, true);


--
-- Name: trucks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.trucks_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: patrick
--

SELECT pg_catalog.setval('public.users_id_seq', 15, true);


--
-- Name: additional_services additional_services_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.additional_services
    ADD CONSTRAINT additional_services_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: customers customers_email_unique; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_unique UNIQUE (email);


--
-- Name: customers customers_phone_key; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_phone_key UNIQUE (phone);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: estimate_additional_services estimate_additional_services_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimate_additional_services
    ADD CONSTRAINT estimate_additional_services_pkey PRIMARY KEY (id);


--
-- Name: estimate_inventory_items estimate_inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimate_inventory_items
    ADD CONSTRAINT estimate_inventory_items_pkey PRIMARY KEY (id);


--
-- Name: estimate_residence_sizes estimate_residence_sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimate_residence_sizes
    ADD CONSTRAINT estimate_residence_sizes_pkey PRIMARY KEY (id);


--
-- Name: estimates estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_pkey PRIMARY KEY (id);


--
-- Name: fuel_price_tiers fuel_price_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.fuel_price_tiers
    ADD CONSTRAINT fuel_price_tiers_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: mover_assignment_rules mover_assignment_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.mover_assignment_rules
    ADD CONSTRAINT mover_assignment_rules_pkey PRIMARY KEY (id);


--
-- Name: mover_teams mover_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.mover_teams
    ADD CONSTRAINT mover_teams_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_key UNIQUE (token);


--
-- Name: residence_sizes residence_sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.residence_sizes
    ADD CONSTRAINT residence_sizes_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: trucks trucks_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.trucks
    ADD CONSTRAINT trucks_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: estimate_additional_services trig_additional_services_before_insert_update; Type: TRIGGER; Schema: public; Owner: patrick
--

CREATE TRIGGER trig_additional_services_before_insert_update BEFORE INSERT OR UPDATE ON public.estimate_additional_services FOR EACH ROW EXECUTE FUNCTION public.update_additional_service_totals();


--
-- Name: customers trigger_log_customers_changes; Type: TRIGGER; Schema: public; Owner: patrick
--

CREATE TRIGGER trigger_log_customers_changes AFTER UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.log_customers_changes();


--
-- Name: customers trigger_log_customers_delete; Type: TRIGGER; Schema: public; Owner: patrick
--

CREATE TRIGGER trigger_log_customers_delete AFTER DELETE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.log_delete_audit();


--
-- Name: estimates trigger_log_estimates_changes; Type: TRIGGER; Schema: public; Owner: patrick
--

CREATE TRIGGER trigger_log_estimates_changes AFTER UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.log_estimates_changes();


--
-- Name: estimates trigger_log_estimates_delete; Type: TRIGGER; Schema: public; Owner: patrick
--

CREATE TRIGGER trigger_log_estimates_delete AFTER DELETE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.log_delete_audit();


--
-- Name: estimate_inventory_items trigger_populate_item_details; Type: TRIGGER; Schema: public; Owner: patrick
--

CREATE TRIGGER trigger_populate_item_details BEFORE INSERT ON public.estimate_inventory_items FOR EACH ROW EXECUTE FUNCTION public.populate_item_details();


--
-- Name: estimate_residence_sizes trigger_populate_residence_details; Type: TRIGGER; Schema: public; Owner: patrick
--

CREATE TRIGGER trigger_populate_residence_details BEFORE INSERT ON public.estimate_residence_sizes FOR EACH ROW EXECUTE FUNCTION public.populate_residence_details();


--
-- Name: additional_services additional_services_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.additional_services
    ADD CONSTRAINT additional_services_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: customers customers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: estimate_additional_services estimate_additional_services_additional_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimate_additional_services
    ADD CONSTRAINT estimate_additional_services_additional_service_id_fkey FOREIGN KEY (additional_service_id) REFERENCES public.additional_services(id);


--
-- Name: estimate_additional_services estimate_additional_services_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimate_additional_services
    ADD CONSTRAINT estimate_additional_services_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE CASCADE;


--
-- Name: estimate_inventory_items estimate_inventory_items_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimate_inventory_items
    ADD CONSTRAINT estimate_inventory_items_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE CASCADE;


--
-- Name: estimate_inventory_items estimate_inventory_items_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimate_inventory_items
    ADD CONSTRAINT estimate_inventory_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id);


--
-- Name: estimate_residence_sizes estimate_residence_sizes_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimate_residence_sizes
    ADD CONSTRAINT estimate_residence_sizes_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE CASCADE;


--
-- Name: estimate_residence_sizes estimate_residence_sizes_residence_size_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimate_residence_sizes
    ADD CONSTRAINT estimate_residence_sizes_residence_size_id_fkey FOREIGN KEY (residence_size_id) REFERENCES public.residence_sizes(id);


--
-- Name: fuel_price_tiers fuel_price_tiers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.fuel_price_tiers
    ADD CONSTRAINT fuel_price_tiers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: inventory_items inventory_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: messages messages_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.estimates(id) ON DELETE CASCADE;


--
-- Name: messages messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: mover_assignment_rules mover_assignment_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.mover_assignment_rules
    ADD CONSTRAINT mover_assignment_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: mover_teams mover_teams_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.mover_teams
    ADD CONSTRAINT mover_teams_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: estimates opportunities_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT opportunities_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: estimates opportunities_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT opportunities_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: residence_sizes residence_sizes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.residence_sizes
    ADD CONSTRAINT residence_sizes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: trucks trucks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.trucks
    ADD CONSTRAINT trucks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: patrick
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.refresh_tokens TO patrick;


--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.refresh_tokens_id_seq TO patrick;


--
-- PostgreSQL database dump complete
--

